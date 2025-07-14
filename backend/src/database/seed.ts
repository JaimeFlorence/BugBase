import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bugbase.com' },
    update: {},
    create: {
      email: 'admin@bugbase.com',
      username: 'admin',
      passwordHash: adminPassword,
      fullName: 'System Administrator',
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  console.log('Created admin user:', admin);

  // Create test users
  const testPassword = await bcrypt.hash('test123', 10);
  
  const projectManager = await prisma.user.upsert({
    where: { email: 'pm@bugbase.com' },
    update: {},
    create: {
      email: 'pm@bugbase.com',
      username: 'projectmanager',
      passwordHash: testPassword,
      fullName: 'Project Manager',
      role: 'PROJECT_MANAGER',
      emailVerified: true,
    },
  });

  const developer = await prisma.user.upsert({
    where: { email: 'dev@bugbase.com' },
    update: {},
    create: {
      email: 'dev@bugbase.com',
      username: 'developer',
      passwordHash: testPassword,
      fullName: 'John Developer',
      role: 'DEVELOPER',
      emailVerified: true,
    },
  });

  const qaUser = await prisma.user.upsert({
    where: { email: 'qa@bugbase.com' },
    update: {},
    create: {
      email: 'qa@bugbase.com',
      username: 'qatester',
      passwordHash: testPassword,
      fullName: 'Jane QA',
      role: 'QA_TESTER',
      emailVerified: true,
    },
  });

  console.log('Created test users');

  // Create test project
  const project = await prisma.project.upsert({
    where: { key: 'DEMO' },
    update: {},
    create: {
      name: 'Demo Project',
      key: 'DEMO',
      description: 'A demo project for testing the bug tracker',
      ownerId: admin.id,
      isPublic: true,
    },
  });

  console.log('Created demo project:', project);

  // Add team members to project
  await prisma.projectMember.createMany({
    data: [
      {
        projectId: project.id,
        userId: projectManager.id,
        permissions: JSON.stringify({
          canManageProject: true,
          canManageBugs: true,
          canManageMembers: true,
        }),
      },
      {
        projectId: project.id,
        userId: developer.id,
        permissions: JSON.stringify({
          canManageBugs: true,
          canComment: true,
        }),
      },
      {
        projectId: project.id,
        userId: qaUser.id,
        permissions: JSON.stringify({
          canManageBugs: true,
          canComment: true,
          canTestBugs: true,
        }),
      },
    ],
    skipDuplicates: true,
  });

  console.log('Added team members to project');

  // Create labels
  const labels = await Promise.all([
    prisma.label.upsert({
      where: { projectId_name: { projectId: project.id, name: 'bug' } },
      update: {},
      create: {
        projectId: project.id,
        name: 'bug',
        color: '#EF4444',
        description: 'Something is not working',
      },
    }),
    prisma.label.upsert({
      where: { projectId_name: { projectId: project.id, name: 'enhancement' } },
      update: {},
      create: {
        projectId: project.id,
        name: 'enhancement',
        color: '#3B82F6',
        description: 'New feature or request',
      },
    }),
    prisma.label.upsert({
      where: { projectId_name: { projectId: project.id, name: 'documentation' } },
      update: {},
      create: {
        projectId: project.id,
        name: 'documentation',
        color: '#10B981',
        description: 'Improvements or additions to documentation',
      },
    }),
  ]);

  console.log('Created labels');

  // Create milestone
  const milestone = await prisma.milestone.upsert({
    where: { projectId_name: { projectId: project.id, name: 'v1.0.0' } },
    update: {},
    create: {
      projectId: project.id,
      name: 'v1.0.0',
      description: 'First stable release',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });

  console.log('Created milestone');

  // Create sample bugs
  const bugs = await Promise.all([
    prisma.bug.create({
      data: {
        projectId: project.id,
        bugNumber: 1,
        title: 'Login page shows error on first load',
        description: 'When accessing the login page for the first time, a console error appears. The error disappears on refresh.',
        status: 'NEW',
        priority: 'HIGH',
        severity: 'MAJOR',
        reporterId: qaUser.id,
        assigneeId: developer.id,
        milestoneId: milestone.id,
        environment: 'Production',
        versionFound: '0.9.0',
      },
    }),
    prisma.bug.create({
      data: {
        projectId: project.id,
        bugNumber: 2,
        title: 'Add dark mode support',
        description: 'Users have requested a dark mode option for better visibility in low-light conditions.',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        severity: 'MINOR',
        reporterId: projectManager.id,
        assigneeId: developer.id,
        milestoneId: milestone.id,
      },
    }),
    prisma.bug.create({
      data: {
        projectId: project.id,
        bugNumber: 3,
        title: 'Performance issues with large bug lists',
        description: 'When there are more than 1000 bugs in a project, the bug list page becomes slow and unresponsive.',
        status: 'NEW',
        priority: 'CRITICAL',
        severity: 'BLOCKER',
        reporterId: developer.id,
        environment: 'All environments',
      },
    }),
  ]);

  console.log('Created sample bugs');

  // Add labels to bugs
  await prisma.bugLabel.createMany({
    data: [
      { bugId: bugs[0].id, labelId: labels[0].id }, // bug label
      { bugId: bugs[1].id, labelId: labels[1].id }, // enhancement label
      { bugId: bugs[2].id, labelId: labels[0].id }, // bug label
    ],
  });

  // Create comments
  await prisma.comment.createMany({
    data: [
      {
        bugId: bugs[0].id,
        userId: developer.id,
        content: 'I can reproduce this issue. Working on a fix.',
      },
      {
        bugId: bugs[0].id,
        userId: qaUser.id,
        content: 'Thanks! Let me know when it\'s ready for testing.',
      },
      {
        bugId: bugs[1].id,
        userId: developer.id,
        content: 'Started implementing dark mode. Should be ready by end of week.',
      },
    ],
  });

  console.log('Created comments');

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });