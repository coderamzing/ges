import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { renderTemplate } from 'utils/handlebar';

/**
 * Test cases for Event Status Interpretation
 * 
 * Simple array structure: input messages and expected output
 * Loop through each test case, call prompt query, and validate results
 */

interface EventTestCase {
    input: string; // Full message input
    expected: {
        status: string;
        score?: number | null;
        score_reason?: string | null;
    };
}

// Array of test cases: input messages and expected outputs
const testCases: EventTestCase[] = [
    { input: 'Yes, I will be there!', expected: { status: 'confirmed' } },
    { input: 'Sure, count me in.', expected: { status: 'confirmed' } },
    { input: 'I am coming for sure.', expected: { status: 'confirmed' } },
    { input: 'Sounds good, I will join.', expected: { status: 'confirmed' } },
    { input: 'Yes, booking my slot.', expected: { status: 'confirmed' } },
    { input: 'Alright, see you there.', expected: { status: 'confirmed' } },
    { input: 'Definitely attending.', expected: { status: 'confirmed' } },
    { input: 'I will attend this.', expected: { status: 'confirmed' } },
    { input: 'Looking forward, I am in.', expected: { status: 'confirmed' } },
    { input: 'Okay, I will be present.', expected: { status: 'confirmed' } },

    { input: 'No, I cannot come.', expected: { status: 'declined' } },
    { input: 'Sorry, not possible.', expected: { status: 'declined' } },
    { input: 'I am busy that day.', expected: { status: 'declined' } },
    { input: 'Not interested.', expected: { status: 'declined' } },
    { input: 'Please stop messaging me.', expected: { status: 'declined' } },
    { input: 'I won’t be able to attend.', expected: { status: 'declined' } },
    { input: 'No thanks.', expected: { status: 'declined' } },
    { input: 'Already have plans.', expected: { status: 'declined' } },
    { input: 'I am not in town.', expected: { status: 'declined' } },
    { input: 'Can’t make it.', expected: { status: 'declined' } },

    { input: 'Maybe, I will see.', expected: { status: 'maybe' } },
    { input: 'Not sure yet.', expected: { status: 'maybe' } },
    { input: 'I will let you know.', expected: { status: 'maybe' } },
    { input: 'I need to check first.', expected: { status: 'maybe' } },
    { input: 'Sounds interesting, maybe.', expected: { status: 'maybe' } },
    { input: 'I am thinking about it.', expected: { status: 'maybe' } },
    { input: 'Can decide later.', expected: { status: 'maybe' } },
    { input: 'Possibly, depends.', expected: { status: 'maybe' } },
    { input: 'I might join.', expected: { status: 'maybe' } },
    { input: 'Let me confirm later.', expected: { status: 'maybe' } },

    { input: 'Yes I am coming.\nSorry, something came up.', expected: { status: 'optout' } },
    { input: 'Count me in.\nI can’t attend now.', expected: { status: 'optout' } },
    { input: 'I will join.\nActually, cancel it.', expected: { status: 'optout' } },
    { input: 'Confirmed.\nNot possible anymore.', expected: { status: 'optout' } },
    { input: 'Yes, attending.\nBusy now.', expected: { status: 'optout' } },
    { input: 'Sure, I will be there.\nI won’t make it.', expected: { status: 'optout' } },
    { input: 'I am in.\nNeed to drop out.', expected: { status: 'optout' } },
    { input: 'Booked my time.\nCancelling.', expected: { status: 'optout' } },
    { input: 'Joining for sure.\nPlans changed.', expected: { status: 'optout' } },
    { input: 'Yes confirmed.\nCan’t attend.', expected: { status: 'optout' } },

    { input: 'Interested.\nActually no.', expected: { status: 'optout' } },
    { input: 'Sounds good.\nBusy that day.', expected: { status: 'optout' } },
    { input: 'Looks interesting.\nI can’t join.', expected: { status: 'optout' } },
    { input: 'I might join.\nNot coming.', expected: { status: 'optout' } },
    { input: 'Maybe yes.\nSorry no.', expected: { status: 'optout' } },

    { input: 'Yes.', expected: { status: 'confirmed' } },
    { input: 'No.', expected: { status: 'declined' } },
    { input: 'Maybe.', expected: { status: 'maybe' } },

    { input: 'Okay.\nCancel it.', expected: { status: 'optout' } },
    { input: 'Confirmed earlier.\nNot attending.', expected: { status: 'optout' } },

    { input: 'Thanks, I will join.', expected: { status: 'confirmed' } },
    { input: 'Sorry, not joining.', expected: { status: 'declined' } },
    { input: 'Let me think.', expected: { status: 'maybe' } },

    { input: 'Yes I will attend.\nStop.', expected: { status: 'optout' } },

    { input: 'Busy right now.', expected: { status: 'declined' } },
    { input: 'Interested for future.', expected: { status: 'maybe' } },
    { input: 'Joining this one.', expected: { status: 'confirmed' } },
    { input: 'Can’t do this.', expected: { status: 'declined' } },
    { input: 'Tentative.', expected: { status: 'maybe' } },
    { input: 'I’m out.', expected: { status: 'declined' } },
    { input: 'All set, see you.', expected: { status: 'confirmed' } },
    { input: 'Booked.\nDropping out.', expected: { status: 'optout' } },
    { input: 'Sure.\nWon’t attend.', expected: { status: 'optout' } },
    { input: 'Thinking.\nDecided no.', expected: { status: 'optout' } }
];

describe('Event Status Interpretation Tests', () => {
    let prisma: PrismaService;
    let openAIService: OpenAIService;
    let prompt: any;
    let module: TestingModule;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        prisma = module.get<PrismaService>(PrismaService);
        openAIService = module.get<OpenAIService>(OpenAIService);

        // Check if OpenAI service is available
        if (!openAIService.isServiceAvailable()) {
            throw new Error('OpenAI service is not available. Please set OPENAI_API_KEY.');
        }

        // Get the INTERPRETATION prompt
        prompt = await prisma.aiPrompt.findFirst({
            where: {
                key: 'INTERPRETATION',
            },
        });

        if (!prompt) {
            throw new Error('INTERPRETATION prompt not found in database');
        }
    });

    afterAll(async () => {
        // Clean up to prevent worker process warnings
        if (module) {
            await module.close();
        }
    });

    // Loop through test cases array and create Jest tests
    testCases.forEach((testCase, index) => {
        it(`Test ${index + 1}: ${testCase.input}`, async () => {
            // Prepare the prompt with input message
            const promptText = renderTemplate(prompt.defs, {
                messages: testCase.input,
            });
            const sysPrompt = prompt.role;

            // Call OpenAI query
            const response = await openAIService.query(promptText, sysPrompt);

            // Log the response for debugging
            // console.log(`\nTest ${index + 1} Response:`, JSON.stringify(response, null, 2));
            // console.log(`Expected:`, JSON.stringify(testCase.expected, null, 2));

            // Validate status
            try {
                expect(response.status?.toLowerCase()).toBe(testCase.expected.status.toLowerCase());
            } catch (error) {
                console.log(testCase.input);
                console.error(
                    `❌ Status mismatch: Expected "${testCase.expected.status}", Got "${response.status}"`,
                );
                throw error;
            }

            // Validate score (allow ±2 tolerance for LLM variability)
            if (testCase.expected.score !== undefined) {
                const scoreDiff = Math.abs((response.score || 0) - testCase.expected.score);
                try {
                    expect(scoreDiff).toBeLessThanOrEqual(2);
                } catch (error) {
                    console.error(
                        `❌ Score mismatch: Expected ${testCase.expected.score}, Got ${response.score} (diff: ${scoreDiff})`,
                    );
                    throw error;
                }
            }

            // Validate score_reason
            if (testCase.expected.score_reason !== undefined) {
                try {
                    expect(response.score_reason?.toLowerCase()).toBe(
                        testCase.expected.score_reason.toLowerCase(),
                    );
                } catch (error) {
                    console.error(
                        `❌ Score reason mismatch: Expected "${testCase.expected.score_reason}", Got "${response.score_reason}"`,
                    );
                    throw error;
                }
            }
        });
    });
});
