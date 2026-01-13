import { faker } from '@faker-js/faker';
import { Prisma } from '@prisma/client';

export class TalentFactory {
  static make(overrides?: Partial<Prisma.TalentPoolCreateInput>): Prisma.TalentPoolCreateInput {
    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      talentType: faker.helpers.arrayElement(['model', 'elite', 'civilian']),
      currentCity: faker.location.city(),
      city: faker.location.city(),
      country: faker.location.country(),
      followers: BigInt(faker.number.int({ min: 0, max: 1000000 })),
      ...overrides,
    };
  }

  static makeMany(
    count: number,
    overrides?: Partial<Prisma.TalentPoolCreateInput>,
  ): Prisma.TalentPoolCreateInput[] {
    return Array.from({ length: count }, () => this.make(overrides));
  }
}

