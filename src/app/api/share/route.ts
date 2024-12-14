import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Conversation } from '@/types';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// POST request handler - Called when sharing a conversation
export async function POST(req: NextRequest) {
  try {
    // Log that we received a POST request
    console.log('Received POST request to /api/share');

    // Parse the request body
    const data = await req.json();
    console.log('Received conversation data:', data);

    if (!data.conversation) {
      console.error('No conversation data provided');
      return NextResponse.json(
        { error: 'No conversation data provided' },
        { status: 400 }
      );
    }

    const conversation = data.conversation as Conversation;
    const id = conversation.id;

    // Store in Redis
    console.log('Storing conversation with ID:', id);
    await redis.set(`conversation:${id}`, JSON.stringify(conversation), {
      ex: 60 * 60 * 24 * 7 // Expire after 7 days
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('POST /api/share error:', error);
    return NextResponse.json(
      { error: 'Failed to share conversation' },
      { status: 500 }
    );
  }
}

// GET request handler - Called when loading a shared conversation
export async function GET(req: NextRequest) {
  try {
    // Get conversation ID from URL parameters
    const id = req.nextUrl.searchParams.get('id');
    console.log('Received GET request for conversation:', id);

    if (!id) {
      console.error('No conversation ID provided');
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Retrieve from Redis
    const conversationData = await redis.get(`conversation:${id}`);
    console.log('Retrieved conversation data:', conversationData ? 'found' : 'not found');

    if (!conversationData) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const conversation = JSON.parse(conversationData as string);
    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('GET /api/share error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve conversation' },
      { status: 500 }
    );
  }
}