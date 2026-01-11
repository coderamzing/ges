import { PrismaClient } from '@prisma/client';
import { TalentSeeder } from '../src/seeders/talent.seeder';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Talent seeding...\n');

  try {
    // Seed Talents
    const talentSeeder = new TalentSeeder(prisma);
    await talentSeeder.seed(100);

    console.log('\n✅ Talent seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

