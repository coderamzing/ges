import { PrismaClient } from '@prisma/client';
import { TalentFactory } from '../factories/talent.factory';

export class TalentSeeder {
  constructor(private prisma: PrismaClient) {}

  async seed(count: number = 50) {
    console.log(`Seeding ${count} talents...`);
    
    const talents = TalentFactory.makeMany(count);
    
    for (const talentData of talents) {
      await this.prisma.talent.create({
        data: talentData,
      });
    }
    
    console.log(`✓ Seeded ${count} talents`);
    
    return this.prisma.talent.findMany();
  }

  async clear() {
    console.log('Clearing talents...');
    await this.prisma.talent.deleteMany({});
    console.log('✓ Cleared talents');
  }
}

