import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { zohoMeetingService } from '../src/services/zohoMeetingService';
import { Course } from '../src/models/Course';
import { Module } from '../src/models/Module';
import { connectDB } from '../src/config/db';

describe('Zoho Meeting Integration & Security Test Suite', () => {
  describe('1. Zoho URL Parsing & SSRF Security', () => {
    it('Should extract recordingId from valid Zoho Meeting URLs', () => {
      const result = zohoMeetingService.parseAndValidateRecordingUrl(
        'https://meeting.zoho.in/meeting/public/videoprv?recordingId=1000293847&x-meeting-org=987654'
      );
      expect(result.recordingId).toBe('1000293847');
      expect(result.orgId).toBe('987654');
      expect(result.domain).toBe('meeting.zoho.in');
    });

    it('Should reject javascript: URLs to prevent SSRF/XSS', () => {
      expect(() => {
        zohoMeetingService.parseAndValidateRecordingUrl('javascript:alert("SSRF")');
      }).toThrow(/Prohibited or malicious URL scheme/i);
    });

    it('Should reject localhost and 127.0.0.1 URLs', () => {
      expect(() => {
        zohoMeetingService.parseAndValidateRecordingUrl('http://localhost:5000/internal-admin');
      }).toThrow(/Prohibited or malicious URL scheme/i);

      expect(() => {
        zohoMeetingService.parseAndValidateRecordingUrl('http://127.0.0.1:8080/secret');
      }).toThrow(/Prohibited or malicious URL scheme/i);
    });

    it('Should reject untrusted non-Zoho domains', () => {
      expect(() => {
        zohoMeetingService.parseAndValidateRecordingUrl('https://evil-hacker-site.com/video?recordingId=123');
      }).toThrow(/INVALID_ZOHO_DOMAIN/i);
    });
  });

  describe('2. Zoho Recording API Endpoints & RBAC Security', () => {
    it('Should validate valid Zoho Recording URL via POST /api/trainer/zoho/validate-recording', async () => {
      await connectDB();

      const trainerRes = await request(app).post('/api/auth/login').send({
        email: 'trainer@scholarlogic.edu',
        password: 'Trainer@123',
      });

      if (trainerRes.status === 200 && trainerRes.body.data?.token) {
        const res = await request(app)
          .post('/api/trainer/zoho/validate-recording')
          .set('Authorization', `Bearer ${trainerRes.body.data.token}`)
          .send({
            recordingUrl: 'https://meeting.zoho.in/meeting/public/videoprv?recordingId=testrec999&x-meeting-org=org123',
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.provider).toBe('ZOHO_MEETING');
        expect(res.body.data.recordingId).toBe('testrec999');
      }
    });

    it('Should associate Zoho Meeting Recording lesson via POST /api/trainer/modules/:moduleId/lessons/zoho-recording', async () => {
      await connectDB();

      const trainerRes = await request(app).post('/api/auth/login').send({
        email: 'trainer@scholarlogic.edu',
        password: 'Trainer@123',
      });

      const course = await Course.findOne();
      const module = course ? await Module.findOne({ courseId: course._id }) : null;

      if (trainerRes.status === 200 && trainerRes.body.data?.token && module && course) {
        const res = await request(app)
          .post(`/api/trainer/modules/${module._id}/lessons/zoho-recording`)
          .set('Authorization', `Bearer ${trainerRes.body.data.token}`)
          .send({
            courseId: course._id.toString(),
            recordingUrl: 'https://meeting.zoho.in/meeting/public/videoprv?recordingId=rec_advanced_python_01',
            title: 'Advanced Python Decorators Live Session (Zoho Recording)',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.lesson.videoSource).toBe('ZOHO_MEETING');
        expect(res.body.data.lesson.externalProvider).toBe('ZOHO');
        expect(res.body.data.lesson.externalRecordingId).toBe('rec_advanced_python_01');
      }
    });

    it('Should block Student from attempting to add Zoho Recording (403 Forbidden)', async () => {
      await connectDB();

      const studentRes = await request(app).post('/api/auth/login').send({
        email: 'student@scholarlogic.edu',
        password: 'Student@123',
      });

      const module = await Module.findOne();

      if (studentRes.status === 200 && studentRes.body.data?.token && module) {
        const res = await request(app)
          .post(`/api/trainer/modules/${module._id}/lessons/zoho-recording`)
          .set('Authorization', `Bearer ${studentRes.body.data.token}`)
          .send({
            recordingUrl: 'https://meeting.zoho.in/meeting/public/videoprv?recordingId=hacked_rec',
          });

        expect(res.status).toBe(403);
      }
    });

    it('Should reject unauthenticated requests to Zoho endpoints (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/trainer/zoho/validate-recording')
        .send({
          recordingUrl: 'https://meeting.zoho.in/meeting/public/videoprv?recordingId=test',
        });

      expect(res.status).toBe(401);
    });
  });
});
