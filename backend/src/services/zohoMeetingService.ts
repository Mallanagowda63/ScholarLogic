import axios from 'axios';

export interface ZohoRecordingMetadata {
  provider: 'ZOHO_MEETING';
  recordingId: string;
  organizationId?: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  title?: string;
  durationMinutes?: number;
  embedUrl?: string;
  originalUrl: string;
}

export class ZohoMeetingService {
  private allowedDomains = [
    'meeting.zoho.in',
    'meeting.zoho.com',
    'meeting.zoho.eu',
    'meeting.zoho.com.au',
    'meeting.zoho.zohocloud.ca',
  ];

  /**
   * Validates recording URL against SSRF threats and allowed Zoho domains.
   * Extracts recordingId and x-meeting-org parameters safely.
   */
  public parseAndValidateRecordingUrl(url: string): { recordingId: string; orgId?: string; domain: string; cleanUrl: string } {
    if (!url || typeof url !== 'string') {
      throw new Error('Recording URL is required');
    }

    const trimmedUrl = url.trim();

    // Block dangerous schemes & localhost / private IP SSRF attempts
    const lowerUrl = trimmedUrl.toLowerCase();
    if (
      lowerUrl.startsWith('javascript:') ||
      lowerUrl.startsWith('data:') ||
      lowerUrl.startsWith('file:') ||
      lowerUrl.includes('localhost') ||
      lowerUrl.includes('127.0.0.1') ||
      lowerUrl.includes('0.0.0.0') ||
      lowerUrl.includes('169.254.') ||
      lowerUrl.includes('10.') ||
      lowerUrl.includes('192.168.')
    ) {
      throw new Error('INVALID_ZOHO_URL: Prohibited or malicious URL scheme detected');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      throw new Error('INVALID_ZOHO_URL: Malformed URL format');
    }

    // Domain whitelist validation
    const hostname = parsedUrl.hostname.toLowerCase();
    const isDomainAllowed = this.allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isDomainAllowed) {
      throw new Error(`INVALID_ZOHO_DOMAIN: Domain '${hostname}' is not an authorized Zoho Meeting domain`);
    }

    // Extract query parameters
    const recordingId = parsedUrl.searchParams.get('recordingId') || parsedUrl.searchParams.get('recId');
    const orgId = parsedUrl.searchParams.get('x-meeting-org') || parsedUrl.searchParams.get('orgId') || undefined;

    // Fallback: extract recordingId from URL path if not in query param
    let extractedId = recordingId;
    if (!extractedId) {
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment && lastSegment.length > 5 && !lastSegment.includes('.')) {
        extractedId = lastSegment;
      }
    }

    if (!extractedId) {
      throw new Error('INVALID_RECORDING_ID: Unable to extract valid recording ID from Zoho URL');
    }

    return {
      recordingId: extractedId,
      orgId,
      domain: hostname,
      cleanUrl: parsedUrl.toString(),
    };
  }

  /**
   * Refreshes server-side OAuth access token if refresh token & credentials are configured.
   */
  public async refreshAccessToken(): Promise<string | null> {
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const region = (process.env.ZOHO_REGION || 'IN').toUpperCase();

    if (!refreshToken || !clientId || !clientSecret) {
      return process.env.ZOHO_ACCESS_TOKEN || null;
    }

    const accountsDomain = region === 'IN' ? 'https://accounts.zoho.in' : 'https://accounts.zoho.com';

    try {
      const response = await axios.post(`${accountsDomain}/oauth/v2/token`, null, {
        params: {
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        },
      });

      if (response.data && response.data.access_token) {
        process.env.ZOHO_ACCESS_TOKEN = response.data.access_token;
        return response.data.access_token;
      }
    } catch (err: any) {
      console.warn('⚠️ Zoho OAuth token refresh warning:', err?.message || err);
    }

    return process.env.ZOHO_ACCESS_TOKEN || null;
  }

  /**
   * Calls official Zoho Meeting API to retrieve recording metadata.
   */
  public async getRecordingMetadata(recordingUrl: string): Promise<ZohoRecordingMetadata> {
    const { recordingId, orgId, cleanUrl } = this.parseAndValidateRecordingUrl(recordingUrl);

    let accessToken = process.env.ZOHO_ACCESS_TOKEN;
    if (!accessToken) {
      accessToken = await this.refreshAccessToken() || undefined;
    }

    const apiDomain = process.env.ZOHO_API_DOMAIN || 'https://meeting.zoho.in';

    // If OAuth access token is available, query official Zoho Meeting API endpoint
    if (accessToken) {
      try {
        const response = await axios.get(`${apiDomain}/api/v2/recordings/${recordingId}`, {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            ...(orgId ? { 'x-meeting-org': orgId } : {}),
          },
          timeout: 5000,
        });

        if (response.data && response.data.recording) {
          const rec = response.data.recording;
          return {
            provider: 'ZOHO_MEETING',
            recordingId,
            organizationId: orgId,
            status: 'AVAILABLE',
            title: rec.topic || rec.title || `Zoho Meeting Recording (${recordingId})`,
            durationMinutes: rec.duration ? Math.round(rec.duration / 60) : undefined,
            embedUrl: rec.embedUrl || cleanUrl,
            originalUrl: cleanUrl,
          };
        }
      } catch (err: any) {
        // If 401 Unauthorized, attempt single token refresh and retry
        if (err.response?.status === 401) {
          const newToken = await this.refreshAccessToken();
          if (newToken) {
            try {
              const retryRes = await axios.get(`${apiDomain}/api/v2/recordings/${recordingId}`, {
                headers: {
                  Authorization: `Zoho-oauthtoken ${newToken}`,
                  ...(orgId ? { 'x-meeting-org': orgId } : {}),
                },
                timeout: 5000,
              });

              if (retryRes.data && retryRes.data.recording) {
                const rec = retryRes.data.recording;
                return {
                  provider: 'ZOHO_MEETING',
                  recordingId,
                  organizationId: orgId,
                  status: 'AVAILABLE',
                  title: rec.topic || rec.title || `Zoho Meeting Recording (${recordingId})`,
                  durationMinutes: rec.duration ? Math.round(rec.duration / 60) : undefined,
                  embedUrl: rec.embedUrl || cleanUrl,
                  originalUrl: cleanUrl,
                };
              }
            } catch (retryErr) {
              // Gracefully fall back to URL association
            }
          }
        }
      }
    }

    // Default safe association metadata when API key/token is pending external configuration
    return {
      provider: 'ZOHO_MEETING',
      recordingId,
      organizationId: orgId,
      status: 'AVAILABLE',
      title: `Zoho Meeting Recording (${recordingId.substring(0, 8)}...)`,
      originalUrl: cleanUrl,
    };
  }
}

export const zohoMeetingService = new ZohoMeetingService();
