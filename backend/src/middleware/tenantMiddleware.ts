import { Request, Response, NextFunction } from 'express';
import { Tenant } from '../models/Tenant';

export interface TenantRequest extends Request {
  tenant?: any;
}

export const tenantMiddleware = async (
  req: TenantRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const hostname = req.hostname || req.headers.host || '';
    const parts = hostname.split('.');

    let subdomain = '';
    if (parts.length >= 2 && !hostname.startsWith('localhost') && !hostname.startsWith('127.0.0.1')) {
      subdomain = parts[0];
    }

    const headerTenantId = req.headers['x-tenant-id'] as string;
    const targetSubdomain = headerTenantId || subdomain;

    if (targetSubdomain && targetSubdomain !== 'www' && targetSubdomain !== 'api') {
      const tenant = await Tenant.findOne({
        $or: [{ subdomain: targetSubdomain }, { customDomain: hostname }],
        status: 'ACTIVE',
      });
      if (tenant) {
        req.tenant = tenant;
      }
    }
  } catch (err) {
    console.warn('⚠️ Tenant resolution warning:', err);
  }
  next();
};
