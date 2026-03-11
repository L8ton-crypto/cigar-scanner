import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureDb } from '@/lib/db';

// Delete (deactivate) an alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDb();
    const { id } = await params;
    const alertId = parseInt(id);
    if (isNaN(alertId)) {
      return NextResponse.json({ error: 'Invalid alert ID' }, { status: 400 });
    }

    // Require email in body for basic auth
    const body = await request.json();
    const { email } = body;
    if (!email) {
      return NextResponse.json({ error: 'Email is required to delete an alert' }, { status: 400 });
    }

    const sql = getDb();

    const result = await sql`
      DELETE FROM cs_alerts 
      WHERE id = ${alertId} AND email = ${email.toLowerCase()}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Alert not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: alertId });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}
