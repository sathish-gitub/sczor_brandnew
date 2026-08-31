import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ 
  connectionString: process.env.DATABASE_URL! 
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const hashedPassword = await bcrypt.hash('demo123', 10)
  
  const user = await prisma.user.updateMany({
    where: { email: 'demo@sczor.com' },
    data: { password: hashedPassword }
  })
  
  console.log('✅ Password reset:', user.count, 'user(s) updated')
  
  const check = await prisma.user.findFirst({
    where: { email: 'demo@sczor.com' },
    select: { email: true, name: true, role: true }
  })
  console.log('User:', check)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
