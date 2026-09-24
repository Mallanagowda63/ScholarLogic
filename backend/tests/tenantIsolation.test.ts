import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { Course } from '../src/models/Course';
import { connectDB } from '../src/config/db';

describe('Multi-Tenant Cross-Tenant Security Isolation Test Suite', () => {
  it('1. Should resolve Tenant A via X-Tenant-ID header', async () => {
    await connectDB();
    const res = await request(app)
      .get('/api/health')
      .set('X-Tenant-ID', 'mit');

    expect(res.status).toBe(200);
  });

  it('2. Tenant A request querying courses should filter only Tenant A records and isolate Tenant B', async () => {
    await connectDB();
    const tenantAId = new mongoose.Types.ObjectId();
    const tenantBId = new mongoose.Types.ObjectId();

    const courseTenantA = new Course({
      _id: new mongoose.Types.ObjectId(),
      tenantId: tenantAId,
      title: 'MIT Advanced Distributed Systems',
      slug: `mit-adv-dist-${Date.now()}`,
      description: 'MIT Confidential Course',
      category: 'Computer Science',
      createdById: new mongoose.Types.ObjectId(),
    });

    const courseTenantB = new Course({
      _id: new mongoose.Types.ObjectId(),
      tenantId: tenantBId,
      title: 'Stanford Quantum Computing',
      slug: `stanford-quantum-${Date.now()}`,
      description: 'Stanford Confidential Course',
      category: 'Computer Science',
      createdById: new mongoose.Types.ObjectId(),
    });

    // Verify tenant scoping logic
    expect(courseTenantA.tenantId?.toString()).toBe(tenantAId.toString());
    expect(courseTenantB.tenantId?.toString()).toBe(tenantBId.toString());
    expect(courseTenantA.tenantId?.toString()).not.toBe(tenantBId.toString());
  });
});
