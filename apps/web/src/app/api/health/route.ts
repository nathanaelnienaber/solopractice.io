import { apiResponse } from '@/lib/web-safety';

export async function GET() {
  return apiResponse({
    status: 'ok',
    version: '0.1.0',
  });
}
