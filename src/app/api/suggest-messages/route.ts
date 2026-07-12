export const dynamic = 'force-dynamic';

import OpenAI from "openai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // no "!" here
    });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, message: "API key missing" },
        { status: 500 }
      );
    }

    const prompt = `
Create a list of three open-ended and engaging questions formatted as a single string.
Each question should be separated by '||'.

These questions are for an anonymous social messaging platform like Qooh.me.
They should be suitable for a diverse audience.
Avoid personal or sensitive topics.
Focus on universal, friendly, and positive themes.

Example format:
"What's a hobby you've recently started?||If you could have dinner with any historical figure, who would it be?||What's a simple thing that makes you happy?"
`;

    const completion = await openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt,
      max_tokens: 300,
    });

    const text = completion.choices[0].text;

    return NextResponse.json({
      success: true,
      data: text,
    });

  } catch (error: any) {
    console.error("AI Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "AI generation failed",
      },
      { status: 500 }
    );
  }
}
