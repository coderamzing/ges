import { faker } from '@faker-js/faker';
import { Prisma } from '@prisma/client';

export class TalentFactory {
  static make(overrides?: Partial<Prisma.TalentCreateInput>): Prisma.TalentCreateInput {
    return {
      name: faker.person.fullName(),
      accountId: faker.string.uuid(),
      talentType: faker.helpers.arrayElement(['model', 'elite', 'civilian']),
      currentCity: faker.location.city(),
      currentCountry: faker.location.country(),
      city: faker.location.city(),
      country: faker.location.country(),
      langPreferred: faker.helpers.arrayElement(['en', 'fr', 'es', 'de', 'it']),
      profilePic: `https://fastly.picsum.photos/id/${faker.number.int({ min: 1, max: 1000 })}/200/300.jpg`,
      followers: faker.number.int({ min: 0, max: 1000000 }),
      rating: faker.number.int({ min: 0, max: 5 }),
      ...overrides,
    };
  }

  static makeMany(
    count: number,
    overrides?: Partial<Prisma.TalentCreateInput>,
  ): Prisma.TalentCreateInput[] {
    return Array.from({ length: count }, () => this.make(overrides));
  }
}

