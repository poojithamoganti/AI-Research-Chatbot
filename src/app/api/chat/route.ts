import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { Groq } from 'groq-sdk';


// Type definitions for better type safety
interface WebSource {
  url: string;
  content: string;
  title?: string;
}

// Initialize Groq client lazily
let groqClient: Groq | null = null;

function getGroqClient() {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

export async function POST(req: NextRequest) {
  try {
    // Get Groq client and handle potential initialization errors
    try {
      getGroqClient();
    } catch (error) {
      console.error('Groq client initialization error:', error);
      return NextResponse.json(
        { error: 'Server configuration error: GROQ_API_KEY not set' },
        { status: 500 }
      );
    }

    // Parse the request body
    const { query, urls } = await req.json();

    // Validate inputs
    if (!query || !urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { error: 'Invalid request. Provide a query and URLs.' }, 
        { status: 400 }
      );
    }

    // Web Scraping function
    async function scrapeWebsites(urls: string[]): Promise<Source[]> {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });
      
      const sources: WebSource[] = [];

      try {
        for (const url of urls) {
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            console.warn(`Skipping invalid URL: ${url}`);
            continue;
          }

          const page = await browser.newPage();
          
          try {
            // Set a more realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

            // Set default navigation timeout to 45 seconds
            await page.setDefaultNavigationTimeout(45000);

            // Set viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // Disable JavaScript to bypass some anti-bot measures
            await page.setJavaScriptEnabled(false);

            // Navigate to the page with multiple retries
            let response = null;
            let retries = 3;
            while (retries > 0 && !response) {
              try {
                response = await page.goto(url, { 
                  waitUntil: 'domcontentloaded', // Changed from networkidle0
                  timeout: 45000
                });
                break;
              } catch (error) {
                retries--;
                if (retries === 0) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between retries
              }
            }

            if (!response || !response.ok()) {
              throw new Error(`Failed to load ${url}: ${response?.status()}`);
            }

            // Get page content
            const content = await page.content();
            const $ = cheerio.load(content);

            // Remove unwanted elements
            $('script, style, noscript, iframe, nav, header, footer, [class*="ad"], [class*="menu"], [id*="menu"]').remove();

            // Try to find main content
            const contentSelectors = [
              'article',
              'main',
              '[role="main"]',
              '.content',
              '#content',
              '.article-body',
              '.post-content',
              '.entry-content',
              '.main-content'
            ];

            let mainContent = '';
            for (const selector of contentSelectors) {
              const element = $(selector);
              if (element.length > 0) {
                mainContent = element.text();
                break;
              }
            }

            // Fallback to body if no main content found
            if (!mainContent) {
              mainContent = $('body').text();
            }

            // Clean the content
            const cleanedContent = mainContent
              .replace(/\s+/g, ' ')
              .replace(/\n+/g, ' ')
              .trim()
              .slice(0, 8000); // Increased length limit

            if (cleanedContent) {
              sources.push({
                url,
                content: cleanedContent,
                title: $('title').text().trim() || url
              });
            }
          } catch (scrapeError) {
            console.error(`Error scraping ${url}:`, scrapeError);
          } finally {
            await page.close();
          }
        }
      } catch (browserError) {
        console.error('Browser setup error:', browserError);
      } finally {
        await browser.close();
      }

      return sources;
    }

    // Generate AI Answer function
    async function generateAnswer(query: string, sources: WebSource[]) {
      if (sources.length === 0) {
        return {
          answer: "I couldn't extract any content from the provided URLs. Please check the URLs and try again.",
          sources: []
        };
      }

      const combinedContext = sources
        .map(source => `[Source: ${source.url}]\n${source.content}`)
        .join('\n\n');

      try {
        const completion = await getGroqClient().chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant that provides accurate, 
                        contextual answers based strictly on the given sources. 
                        Always cite your sources and be transparent about 
                        the information's origin.`
            },
            {
              role: 'user',
              content: `Context:\n${combinedContext}\n\nQuestion: ${query}`
            }
          ],
          model: 'llama3-70b-8192',
          max_tokens: 1024,
          temperature: 0.3,
          top_p: 0.8
        });

        return {
          answer: completion.choices[0]?.message?.content || 'No answer could be generated.',
          sources
        };
      } catch (aiError) {
        console.error('AI generation error:', aiError);
        throw new Error('Failed to generate AI response');
      }
    }

    // Main processing
    const sources = await scrapeWebsites(urls);
    
    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'Could not scrape any content from the provided URLs. Please check the URLs and try again.' }, 
        { status: 404 }
      );
    }

    const response = await generateAnswer(query, sources);
    return NextResponse.json(response);

  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? error.stack : null
      }, 
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';