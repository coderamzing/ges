import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { renderTemplate } from 'utils/handlebar';
import moment from 'moment';

/**
 * Test cases for Location Interpretation
 * 
 * Simple array structure: input messages and expected output
 * Loop through each test case, call prompt query, and validate results
 */

interface LocationTestCase {
    input: string; // Full message input
    expected: {
        currentCity?: string | null;
        futureCity?: string | null;
        futureCityStartAt?: string | null;
        futureCityEndAt?: string | null;
        currentCityEndAt?: string | null;
        cityHome?: string | null;
    };
}

const futureCityStartAt = moment().add(1, 'days').format('YYYY-MM-DD');
const currentCityEndAt = moment(futureCityStartAt).subtract(1, 'days').format('YYYY-MM-DD');

// Array of test cases: input messages and expected outputs
const testCases: LocationTestCase[] = [
    //Test 1
    {
        input: `Hey! I’m in London right now 😊`,
        expected: {
            currentCity: 'London',
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    //Test 2    
    {
        input: `I live in Paris`,
        expected: {
            cityHome: 'Paris',
            currentCity: 'Paris',
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    //Test 3
    {
        input: `I’m going to Milan next week for 3 days`,
        expected: {
            currentCity: null,
            cityHome: null,
            futureCity: 'Milan',
            futureCityStartAt: moment().add(1, 'week').format('YYYY-MM-DD'),
            futureCityEndAt: moment().add(1, 'week').add(3, 'days').endOf('day').format('YYYY-MM-DD'),
            currentCityEndAt: null,
        },
    },
    //Test 4
    {
        input: `I'll be in Berlin from Friday to Sunday`,
        expected: {
            futureCity: 'Berlin',
            futureCityStartAt: moment().day(5).isBefore(moment(), 'day')
                ? moment().day(5).add(7, 'days').format('YYYY-MM-DD')
                : moment().day(5).format('YYYY-MM-DD'),
            futureCityEndAt: moment().day(0).isBefore(moment(), 'day')
                ? moment().day(0).add(7, 'days').format('YYYY-MM-DD')
                : moment().day(0).format('YYYY-MM-DD'),
        },
    },
    //Test 5
    {
        input: `Not in Paris anymore, I’m back in LA now`,
        expected: {
            currentCity: 'Los Angeles',
            cityHome: 'Los Angeles',
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    //Test 6
    {
        input: `I was in Madrid last week but now I’m in Paris`,
        expected: {
            currentCity: 'Paris',
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    //Test 7
    {
        input: `I’m traveling a lot these days`,
        expected: {
            currentCity: null,
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    //Test 8
    {
        input: `I would join you`,
        expected: {
            currentCity: null,
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    //Test 9
    {
        input: `thank you`,
        expected: {
            currentCity: null,
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    //Test 10
    {
        input: `I am currently in London`,
        expected: {
            currentCity: 'London',
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    //Test 11
    {
        input: `I am moving to London in March for 2 weeks`,
        expected: {
            currentCity: null,
            cityHome: null,
            futureCity: 'London',
            futureCityStartAt: moment('2026-03-01').format('YYYY-MM-DD'),
            futureCityEndAt: moment('2026-03-14').format('YYYY-MM-DD'),
            currentCityEndAt: null,
        },
    },
    //Test 12
    {
        input: `I live in Paris, but tomorrow I am moving to Berlin for 1 week`,
        expected: {
            cityHome: 'Paris',
            currentCity: 'Paris',
            futureCity: 'Berlin',
            futureCityStartAt: moment().add(1, 'day').format('YYYY-MM-DD'),
            futureCityEndAt: moment().add(1, 'day').add(1, 'week').format('YYYY-MM-DD'),
            currentCityEndAt: moment().add(1, 'day').format('YYYY-MM-DD'),
        },
    },
    //Test 13
    {
        input: `Talent CityHome: Berlin\nI just left Paris`,
        expected: {
            currentCity: "in_transit",
            cityHome: 'Berlin',
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    //Test 14
    {
        input: `Talent City: Paris\nI am here only until tomorrow`,
        expected: {
            currentCity: 'Paris',
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: moment().add(1, 'day').format('YYYY-MM-DD'),
        },
    },
    //Test 15
    {
        input: `Talent City: Berlin\nI live in Tokyo`,
        expected: {
            currentCity: 'Tokyo',
            cityHome: 'Tokyo',
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    //Test 16
    {
        input: `Talent City: Tokyo\nI am in Dubai until end of March`,
        expected: {
            currentCity: 'Dubai',
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: moment('2026-03-31').format('YYYY-MM-DD'),
        },
    },
    // // Conversation 1 — Simple current city
    // {
    //     input: `Promoter: "Hey 😊 are you in Paris these days?"\n
    //     Girl: "Hey"\nGirl: "No not Paris"\nGirl: "I'm in London right now"\n
    //     Girl: "Just arrived yesterday"`,
    //     expected: {
    //         currentCity: 'London',
    //         cityHome: null,
    //         futureCity: null,
    //         futureCityStartAt: null,
    //         futureCityEndAt: null,
    //         currentCityEndAt: null,
    //     },
    // },
    // // Conversation 2 — Home city + current city
    // {
    //     input: `Promoter: "Are you based in Paris?"\nGirl: "Yes"\nGirl: "I live in Paris"\nGirl: "I'm here most of the time"\nGirl: "Not traveling right now"`,
    //     expected: {
    //         currentCity: 'Paris',
    //         cityHome: 'Paris',
    //         futureCity: null,
    //         futureCityStartAt: null,
    //         futureCityEndAt: null,
    //         currentCityEndAt: null,
    //     },
    // },
    // // Conversation 3 — Traveling now, returning home soon
    // {
    //     input: `Promoter: "Are you around this weekend?"\n
    //     Girl: "Not this week 😕"\n
    //     Girl: "I'm in Milan right now"\n
    //     Girl: "For work"\nGirl: "Back to Paris next week"`,
    //     expected: {
    //         currentCity: 'Milan',
    //         cityHome: null,
    //         futureCity: 'Paris',
    //         futureCityStartAt: moment().add(1, 'week').format('YYYY-MM-DD'),
    //         futureCityEndAt: null,
    //         currentCityEndAt: null,
    //     },
    // },
    // // Conversation 4 — Clear future trip with duration
    // {
    //     input: `Promoter: "Will you be in Paris soon?"\nGirl: "No not Paris"\nGirl: "I'm moving to London in March"\nGirl: "For around 2 weeks"\nGirl: "Then I leave again"`,
    //     expected: {
    //         currentCity: null,
    //         cityHome: null,
    //         futureCity: 'London',
    //         futureCityStartAt: moment('2026-03-01').format('YYYY-MM-DD'),
    //         futureCityEndAt: moment('2026-03-15').format('YYYY-MM-DD'),
    //         currentCityEndAt: null,
    //     },
    // },
    // // Conversation 5 — Home city + short future trip
    // {
    //     input: `Promoter: "Are you free tomorrow?"\nGirl: "I wish 😅"\nGirl: "I live in Paris"\nGirl: "But tomorrow I go to Berlin"\nGirl: "Just for one week"`,
    //     expected: {
    //         currentCity: 'Paris',
    //         cityHome: 'Paris',
    //         futureCity: 'Berlin',
    //         futureCityStartAt: moment().add(1, 'day').format('YYYY-MM-DD'),
    //         futureCityEndAt: moment().add(1, 'day').add(1, 'week').format('YYYY-MM-DD'),
    //         currentCityEndAt: null,
    //     },
    // },
    // // Conversation 6 — Multiple cities, choose current
    // {
    //     input: `Promoter: "Where are you based?"\nGirl: "I travel a lot"\nGirl: "Between Dubai and Paris"\nGirl: "But right now I'm in Dubai"\nGirl: "Since last week"`,
    //     expected: {
    //         currentCity: 'Dubai',
    //         cityHome: 'Paris',
    //         futureCity: null,
    //         futureCityStartAt: null,
    //         futureCityEndAt: null,
    //         currentCityEndAt: null,
    //     },
    // },
    // // Conversation 7 — Ambiguous → must return null
    // {
    //     input: `Promoter: "Are you in town?"\nGirl: "Not sure yet"\nGirl: "Maybe traveling soon"\nGirl: "Depends on work"\nGirl: "I'll see"`,
    //     expected: {
    //         currentCity: null,
    //         cityHome: null,
    //         futureCity: null,
    //         futureCityStartAt: null,
    //         futureCityEndAt: null,
    //         currentCityEndAt: null,
    //     },
    // },

     // intransit
      {
        input: `Girl: "I flew away"`,
        expected: {
            currentCity: 'in_transit',
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },

     {
        input: `Girl: "I’m Leaving"`,
        expected: {
            currentCity: 'in_transit',
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },


    {
        input: `Promoter: "Where do you grains in Germany? Which city?"\n Promoter:You live in Berlin? \nGirl: "Hamburg/Berlin"\nGirl: "Right now I’m flying to Hamburg"`,
        expected: {
            currentCity: 'in_transit',
            cityHome: 'Berlin',
            futureCity: 'Hamburg',
            futureCityStartAt: moment().add(1, 'days').format('YYYY-MM-DD'),
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    
    {
        input: `Promoter: "Where do you live?"\n Promoter:Do you live in Delhi? \nGirl: "no, i live in Mumbai"\nGirl: "Right now, I’m flying to Goa"`,
        expected: {
            currentCity: 'in_transit',
            cityHome: 'Mumbai',
            futureCity: 'Goa',
            futureCityStartAt: moment().add(1, 'days').format('YYYY-MM-DD'),
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },

    {
        input: `Promoter: "Where are you based?"\nGirl: "Bangalore"\nGirl: "I’m traveling to Chennai tomorrow."`,
        expected: {
            currentCity: 'Bangalore',
            cityHome: 'Bangalore',
            futureCity: 'Chennai',
            futureCityStartAt: moment().add(1, 'days').format('YYYY-MM-DD'),
            futureCityEndAt: null,
            currentCityEndAt: moment().add(1, 'days').endOf('day').format('YYYY-MM-DD'),
        },
    },


    {
        input: `Promoter: "Which city do you live in?"\nGirl: "Pune"\nGirl: "Next week, I’ll be in Dubai."`,
        expected: {
            currentCity: 'Pune',
            cityHome: 'Pune',
            futureCity: 'Dubai',
            futureCityStartAt: moment().add(7, 'days').format('YYYY-MM-DD'),
            futureCityEndAt: null,
            currentCityEndAt: moment().add(7, 'days').endOf('day').format('YYYY-MM-DD'),
        },
    },

    {
        input: `Promoter: "Where do you live?"\nGirl: "I’m Nigerian and I live there"\nGirl: "Yes I feel really sad about it"\nGirl: "Wish it was when I was in Paris"\nPromoter: "Okay got it !:) Well next time"\nGirl: "Yes definitely"`,
        expected: {
            currentCity: 'Nigeria',
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },
    
    {
        input: `Promoter: "Amazing"\nPromoter: "Next round this weekend"\nGirl: "Im in the Netherlands right now tho🥲"\nPromoter: "Ah ok"\nPromoter: "When are you coming back ?"\nGirl: "Oehhh idk maybe next month"\nGirl: "But idk for sure"`,
        expected: {
            currentCity: 'Netherlands',
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },

    {
        input: ` Promoter: "Where are you staying?"\nGirl: "I'm in London for work till March"`,
        expected: {
            currentCity: 'London',
            cityHome: null,
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: moment().month(2).endOf('month').format('YYYY-MM-DD'),
        },
    },

    {
        input: `Promoter: "Okay where do you live ?"\nGirl: "In Paris normally for university but since it’s holidays I’m in Monaco visiting family :)"\nPromoter: "Okay cool fair enough"`,
        expected: {
            currentCity: 'Monaco',
            cityHome: 'Paris',
            futureCity: null,
            futureCityStartAt: null,
            futureCityEndAt: null,
            currentCityEndAt: null,
        },
    },


];

/**
 * Parse null string to actual null
 */
function parseNullString(value: string | null | undefined): string | null {
    if (!value || value === 'null' || value === 'NULL' || value.trim() === '') {
        return null;
    }
    return value;
}

/**
 * Compare two dates with ±1 day tolerance
 * Returns true if dates are within 1 day of each other, or both are null
 */
function compareDatesWithTolerance(
    actual: string | null | undefined,
    expected: string | null | undefined,
): boolean {
    // Both null or empty - match
    if (!actual && !expected) {
        return true;
    }

    // One is null, other is not - no match
    if (!actual || !expected) {
        return false;
    }

    // Parse both dates
    const actualDate = moment(actual, 'YYYY-MM-DD', true);
    const expectedDate = moment(expected, 'YYYY-MM-DD', true);

    // Check if dates are valid
    if (!actualDate.isValid() || !expectedDate.isValid()) {
        return false;
    }

    // Calculate difference in days
    const diffDays = Math.abs(actualDate.diff(expectedDate, 'days'));

    // Allow ±1 day tolerance
    return diffDays <= 1;
}

describe('Location Interpretation Tests', () => {
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

        // Get the LOCATION_INTERPRETATION prompt
        prompt = await prisma.aiPrompt.findFirst({
            where: {
                key: 'LOCATION_INTERPRETATION',
            },
        });

        if (!prompt) {
            throw new Error('LOCATION_INTERPRETATION prompt not found in database');
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
        it(`Test ${index + 1}: ${testCase.input} `, async () => {
            // Prepare the prompt with input message
            const promptText = renderTemplate(prompt.defs, {
                messages: `Today: ${moment().format('dddd, MMMM Do YYYY')}\n ${testCase.input}`,
            });
            const sysPrompt = prompt.role;

            // Call OpenAI query
            const response = await openAIService.query(promptText, sysPrompt);

            // Print the raw response
            console.log(`\n Test ${index + 1} \n📋 ${testCase.input} \n - Raw OpenAI Response:`, JSON.stringify(response, null, 2));

            // Parse response
            const interpretation = {
                currentCity: parseNullString(response.currentCity),
                futureCity: parseNullString(response.futureCity),
                futureCityStartAt: response.futureCityStartAt,
                futureCityEndAt: response.futureCityEndAt,
                currentCityEndAt: response.currentCityEndAt,
                cityHome: parseNullString(response.cityHome),
            };

            // Log the response for debugging
            // console.log(`\nTest ${index + 1} Response:`, JSON.stringify(interpretation, null, 2));
            // console.log(`Expected:`, JSON.stringify(testCase.expected, null, 2));

            // Validate currentCity
            if (testCase.expected.currentCity !== undefined) {
                try {
                    expect(interpretation.currentCity || null).toBe(testCase.expected.currentCity || null);
                } catch (error) {
                    console.log(interpretation);
                    console.error(
                        `❌ CurrentCity mismatch: Expected "${testCase.expected.currentCity || 'null'}", Got "${interpretation.currentCity || 'null'}"`,
                    );
                    throw error;
                }
            }

            // Validate futureCity
            if (testCase.expected.futureCity !== undefined) {
                try {
                    expect(interpretation.futureCity || null).toBe(testCase.expected.futureCity || null);
                } catch (error) {
                    console.log(interpretation);
                    console.error(
                        `❌ FutureCity mismatch: Expected "${testCase.expected.futureCity || 'null'}", Got "${interpretation.futureCity || 'null'}"`,
                    );
                    throw error;
                }
            }

            // Validate futureCityStartAt (if expected) - with ±1 day tolerance
            if (testCase.expected.futureCityStartAt !== undefined) {
                try {
                    const isMatch = compareDatesWithTolerance(
                        interpretation.futureCityStartAt,
                        testCase.expected.futureCityStartAt,
                    );
                    expect(isMatch).toBe(true);
                } catch (error) {
                    console.log(interpretation);
                    console.error(
                        `❌ FutureCityStartAt mismatch: Expected "${testCase.expected.futureCityStartAt || 'null'}", Got "${interpretation.futureCityStartAt || 'null'}" (tolerance: ±1 day)`,
                    );
                    throw error;
                }
            }

            // Validate futureCityEndAt (if expected) - with ±1 day tolerance
            if (testCase.expected.futureCityEndAt !== undefined) {
                try {
                    const isMatch = compareDatesWithTolerance(
                        interpretation.futureCityEndAt,
                        testCase.expected.futureCityEndAt,
                    );
                    expect(isMatch).toBe(true);
                } catch (error) {
                    console.log(interpretation);
                    console.error(
                        `❌ FutureCityEndAt mismatch: Expected "${testCase.expected.futureCityEndAt || 'null'}", Got "${interpretation.futureCityEndAt || 'null'}" (tolerance: ±1 day)`,
                    );
                    throw error;
                }
            }

            // Validate currentCityEndAt (if expected) - with ±1 day tolerance
            if (testCase.expected.currentCityEndAt !== undefined) {
                try {
                    const isMatch = compareDatesWithTolerance(
                        interpretation.currentCityEndAt,
                        testCase.expected.currentCityEndAt,
                    );
                    expect(isMatch).toBe(true);
                } catch (error) {
                    console.log(interpretation);
                    console.error(
                        `❌ CurrentCityEndAt mismatch: Expected "${testCase.expected.currentCityEndAt || 'null'}", Got "${interpretation.currentCityEndAt || 'null'}" (tolerance: ±1 day)`,
                    );
                    throw error;
                }
            }

            // Validate cityHome
            if (testCase.expected.cityHome !== undefined) {
                try {
                    expect(interpretation.cityHome || null).toBe(testCase.expected.cityHome || null);
                } catch (error) {
                    console.log(interpretation);
                    console.error(
                        `❌ CityHome mismatch: Expected "${testCase.expected.cityHome || 'null'}", Got "${interpretation.cityHome || 'null'}"`,
                    );
                    throw error;
                }
            }
        });
    });
});
