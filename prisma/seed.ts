import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { attachmentStorage } from "../src/lib/storage";

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu ${name}. Hãy cấu hình file .env trước khi seed.`);
  }
  return value;
}

async function ensureSeedAttachment(
  problemId: string,
  attachmentId: string,
  originalName: string,
  contentType: string,
  content: Uint8Array,
) {
  const existingAttachment = await prisma.problemAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (existingAttachment) {
    return;
  }

  const storageKey = randomUUID();
  await attachmentStorage.save(storageKey, content);
  try {
    await prisma.problemAttachment.create({
      data: {
        id: attachmentId,
        problemId,
        originalName,
        contentType,
        sizeBytes: content.byteLength,
        storageKey,
      },
    });
  } catch (error) {
    try {
      await attachmentStorage.delete(storageKey);
    } catch (cleanupError) {
      console.error("Không thể dọn tệp seed sau lỗi tạo metadata:", cleanupError);
    }
    throw error;
  }
}

const databaseUrl = getRequiredEnvironmentVariable("DATABASE_URL");
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

const businesses = [
  {
    email: "business1@unibridge.local",
    name: "Nguyễn Minh Anh",
    companyName: "Công ty TNHH Thực phẩm An Nhiên",
    industry: "Thực phẩm và bán lẻ",
    website: "https://annhien.example",
    description: "Doanh nghiệp thực phẩm địa phương hướng đến sản phẩm lành mạnh.",
  },
  {
    email: "business2@unibridge.local",
    name: "Trần Quốc Bảo",
    companyName: "Công ty Cổ phần Công nghệ Sao Việt",
    industry: "Công nghệ thông tin",
    website: "https://saoviet.example",
    description: "Doanh nghiệp phát triển giải pháp số cho các doanh nghiệp vừa và nhỏ.",
  },
  {
    email: "business3@unibridge.local",
    name: "Lê Thu Hà",
    companyName: "Công ty TNHH Du lịch Mở",
    industry: "Du lịch và dịch vụ",
    website: "https://dulichmo.example",
    description: "Đơn vị du lịch cộng đồng kết nối du khách với trải nghiệm địa phương.",
  },
];

const teams = [
  {
    slug: "nextgen-digital",
    name: "NextGen Digital",
    university: "Đại học Bách khoa Hà Nội",
    major: "Công nghệ thông tin",
    description: "Nhóm phát triển ứng dụng web và sản phẩm số.",
    skills: ["TypeScript", "Next.js", "Thiết kế giao diện"],
    experience: "Đã xây dựng các ứng dụng web responsive cho dự án môn học và câu lạc bộ.",
    relevantProducts: "https://nextgen.example/portfolio",
    achievements: "Giải Nhì cuộc thi sản phẩm số cấp trường.",
    interests: "Thương mại điện tử, giáo dục số",
  },
  {
    slug: "market-minds",
    name: "Market Minds",
    university: "Đại học Kinh tế Quốc dân",
    major: "Marketing",
    description: "Nhóm nghiên cứu thị trường và xây dựng chiến lược tiếp thị.",
    skills: ["Nghiên cứu thị trường", "Marketing số", "Phân tích dữ liệu"],
    experience: "Đã thực hiện khảo sát người dùng và kế hoạch truyền thông cho các dự án sinh viên.",
    relevantProducts: "https://marketminds.example/portfolio",
    achievements: "Chứng chỉ Google Analytics; Giải Ba cuộc thi Marketing sinh viên.",
    interests: "Nghiên cứu thị trường, bán lẻ, du lịch",
  },
  {
    slug: "data-spark",
    name: "Data Spark",
    university: "Đại học Công nghệ - ĐHQG Hà Nội",
    major: "Khoa học dữ liệu",
    description: "Nhóm khai thác dữ liệu để hỗ trợ quyết định kinh doanh.",
    skills: ["Python", "Phân tích dữ liệu", "Trực quan hóa dữ liệu"],
    experience: "Đã xử lý bộ dữ liệu bán lẻ và xây dựng dashboard phân tích trong dự án học thuật.",
    relevantProducts: "https://dataspark.example/portfolio",
    achievements: "Chứng chỉ phân tích dữ liệu cơ bản.",
    interests: "Phân tích dữ liệu, trí tuệ nhân tạo",
  },
  {
    slug: "creative-lab",
    name: "Creative Lab",
    university: "Đại học Kiến trúc Hà Nội",
    major: "Thiết kế đồ họa",
    description: "Nhóm thiết kế nhận diện thương hiệu và trải nghiệm số.",
    skills: ["Thiết kế đồ họa", "Thiết kế giao diện", "Marketing số"],
    experience: "Đã thiết kế bộ nhận diện và giao diện truyền thông cho một số hoạt động sinh viên.",
    relevantProducts: "https://creativelab.example/portfolio",
    achievements: "Giải Khuyến khích cuộc thi thiết kế sáng tạo.",
    interests: "Thiết kế thương hiệu, trải nghiệm số",
  },
];

const problems = [
  {
    slug: "website-ban-hang-thuc-pham-dia-phuong",
    businessIndex: 0,
    title: "Xây dựng website bán hàng cho thực phẩm địa phương",
    field: "Công nghệ thông tin",
    description: "Doanh nghiệp cần một kênh bán hàng trực tuyến để giới thiệu và phân phối sản phẩm địa phương.",
    goal: "Tạo trải nghiệm mua sắm thuận tiện trên điện thoại và máy tính.",
    requirements: "Có danh mục sản phẩm, thông tin nguồn gốc và quy trình đặt hàng rõ ràng.",
    expectedDuration: "8-10 tuần",
    budgetMin: 15000000,
    budgetMax: 30000000,
    skills: ["Next.js", "TypeScript", "Thiết kế giao diện"],
  },
  {
    slug: "nhan-dien-thuong-hieu-an-nhien",
    businessIndex: 0,
    title: "Làm mới nhận diện thương hiệu An Nhiên",
    field: "Thiết kế",
    description: "Hình ảnh thương hiệu hiện tại chưa thể hiện rõ định vị sản phẩm lành mạnh và gần gũi.",
    goal: "Xây dựng bộ nhận diện nhất quán cho các kênh truyền thông và bao bì.",
    requirements: "Đề xuất định hướng hình ảnh, logo và bộ quy chuẩn sử dụng cơ bản.",
    expectedDuration: "5-7 tuần",
    budgetMin: 8000000,
    budgetMax: 16000000,
    skills: ["Thiết kế đồ họa", "Marketing số"],
  },
  {
    slug: "phan-tich-hanh-vi-khach-hang",
    businessIndex: 0,
    title: "Phân tích hành vi mua hàng của khách hàng",
    field: "Phân tích dữ liệu",
    description: "Dữ liệu đơn hàng đang được tổng hợp thủ công và chưa giúp doanh nghiệp hiểu xu hướng mua.",
    goal: "Tìm ra nhóm sản phẩm, thời điểm và phân khúc khách hàng tiềm năng.",
    requirements: "Làm sạch dữ liệu, phân tích xu hướng và trình bày khuyến nghị.",
    expectedDuration: "4-6 tuần",
    budgetMin: 6000000,
    budgetMax: 12000000,
    skills: ["Python", "Phân tích dữ liệu", "Trực quan hóa dữ liệu"],
  },
  {
    slug: "ung-dung-quan-ly-don-hang",
    businessIndex: 1,
    title: "Thiết kế ứng dụng quản lý đơn hàng nội bộ",
    field: "Công nghệ thông tin",
    description: "Nhân viên đang theo dõi đơn hàng qua nhiều bảng tính, gây khó khăn khi phối hợp.",
    goal: "Tập trung trạng thái đơn hàng và lịch sử xử lý vào một công cụ dễ sử dụng.",
    requirements: "Xây dựng prototype có luồng tạo, cập nhật và tìm kiếm đơn hàng.",
    expectedDuration: "6-8 tuần",
    budgetMin: 12000000,
    budgetMax: 24000000,
    skills: ["Next.js", "TypeScript", "Thiết kế giao diện"],
  },
  {
    slug: "nghien-cuu-thi-truong-phan-mem-sme",
    businessIndex: 1,
    title: "Nghiên cứu nhu cầu phần mềm của doanh nghiệp nhỏ",
    field: "Nghiên cứu thị trường",
    description: "Doanh nghiệp muốn xác định nhu cầu số hóa phổ biến của các cửa hàng nhỏ.",
    goal: "Đề xuất phân khúc khách hàng và cơ hội phát triển sản phẩm.",
    requirements: "Thiết kế khảo sát, tổng hợp phỏng vấn và trình bày kết quả có căn cứ.",
    expectedDuration: "5-6 tuần",
    budgetMin: 7000000,
    budgetMax: 14000000,
    skills: ["Nghiên cứu thị trường", "Marketing số", "Phân tích dữ liệu"],
  },
  {
    slug: "dashboard-theo-doi-hieu-qua-kinh-doanh",
    businessIndex: 1,
    title: "Xây dựng dashboard theo dõi hiệu quả kinh doanh",
    field: "Phân tích dữ liệu",
    description: "Các chỉ số kinh doanh đang nằm ở nhiều nguồn và chưa được theo dõi trực quan.",
    goal: "Tạo dashboard thử nghiệm để theo dõi các chỉ số vận hành chính.",
    requirements: "Làm rõ bộ chỉ số, mô hình dữ liệu và thiết kế báo cáo trực quan.",
    expectedDuration: "6-8 tuần",
    budgetMin: 10000000,
    budgetMax: 20000000,
    skills: ["Python", "Phân tích dữ liệu", "Trực quan hóa dữ liệu"],
  },
  {
    slug: "chien-dich-du-lich-mua-thap-diem",
    businessIndex: 2,
    title: "Đề xuất chiến dịch du lịch mùa thấp điểm",
    field: "Marketing",
    description: "Lượng khách giảm mạnh vào mùa thấp điểm dù địa phương có nhiều trải nghiệm quanh năm.",
    goal: "Tăng mức độ quan tâm và lượt đặt tour trong mùa thấp điểm.",
    requirements: "Xác định chân dung khách hàng, thông điệp và kế hoạch truyền thông thử nghiệm.",
    expectedDuration: "4-5 tuần",
    budgetMin: 5000000,
    budgetMax: 10000000,
    skills: ["Nghiên cứu thị trường", "Marketing số", "Thiết kế đồ họa"],
  },
  {
    slug: "so-hoa-quy-trinh-dat-tour",
    businessIndex: 2,
    title: "Số hóa quy trình tư vấn và đặt tour",
    field: "Công nghệ thông tin",
    description: "Khách hàng thường phải trao đổi qua nhiều kênh trước khi hoàn tất đặt tour.",
    goal: "Đơn giản hóa việc tìm hiểu lịch trình, gửi yêu cầu và nhận xác nhận.",
    requirements: "Thiết kế luồng trải nghiệm và prototype đặt tour trên thiết bị di động.",
    expectedDuration: "6-8 tuần",
    budgetMin: 9000000,
    budgetMax: 18000000,
    skills: ["Thiết kế giao diện", "Next.js", "Nghiên cứu thị trường"],
  },
  {
    slug: "phan-tich-phan-hoi-du-khach",
    businessIndex: 2,
    title: "Phân tích phản hồi của du khách",
    field: "Phân tích dữ liệu",
    description: "Ý kiến khách hàng được lưu rải rác và chưa được phân loại thành hành động cải thiện.",
    goal: "Tổng hợp các chủ đề phản hồi và xác định ưu tiên nâng cao dịch vụ.",
    requirements: "Phân loại dữ liệu phản hồi và đưa ra khuyến nghị dựa trên kết quả.",
    expectedDuration: "3-5 tuần",
    budgetMin: 5000000,
    budgetMax: 10000000,
    skills: ["Python", "Phân tích dữ liệu", "Nghiên cứu thị trường"],
  },
  {
    slug: "bo-nhan-dien-so-du-lich-cong-dong",
    businessIndex: 2,
    title: "Thiết kế bộ nhận diện số cho du lịch cộng đồng",
    field: "Thiết kế",
    description: "Các điểm đến cộng đồng chưa có hình ảnh nhất quán trên website và mạng xã hội.",
    goal: "Tạo bộ tài nguyên hình ảnh số dễ áp dụng cho các chiến dịch giới thiệu điểm đến.",
    requirements: "Đề xuất phong cách hình ảnh, mẫu bài đăng và hướng dẫn sử dụng.",
    expectedDuration: "4-6 tuần",
    budgetMin: 6000000,
    budgetMax: 12000000,
    skills: ["Thiết kế đồ họa", "Marketing số"],
  },
];

async function main() {
  const seedPassword = getRequiredEnvironmentVariable("SEED_USER_PASSWORD");
  const passwordHash = await hash(seedPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@unibridge.local" },
    update: { name: "Quản trị UniBridge", passwordHash, role: "ADMIN" },
    create: {
      email: "admin@unibridge.local",
      name: "Quản trị UniBridge",
      passwordHash,
      role: "ADMIN",
    },
  });

  const businessProfiles = [];
  for (const business of businesses) {
    const user = await prisma.user.upsert({
      where: { email: business.email },
      update: { name: business.name, passwordHash, role: "BUSINESS" },
      create: {
        email: business.email,
        name: business.name,
        passwordHash,
        role: "BUSINESS",
      },
    });
    const profile = await prisma.businessProfile.upsert({
      where: { userId: user.id },
      update: {
        companyName: business.companyName,
        industry: business.industry,
        website: business.website,
        description: business.description,
      },
      create: {
        userId: user.id,
        companyName: business.companyName,
        industry: business.industry,
        website: business.website,
        description: business.description,
      },
    });
    businessProfiles.push(profile);
  }

  const skillIds = new Map<string, string>();
  const skillNames = new Set([
    ...teams.flatMap((team) => team.skills),
    ...problems.flatMap((problem) => problem.skills),
  ]);
  for (const name of skillNames) {
    const skill = await prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    skillIds.set(name, skill.id);
  }

  function getSkillId(name: string): string {
    const skillId = skillIds.get(name);
    if (!skillId) {
      throw new Error(`Không tìm thấy kỹ năng seed: ${name}`);
    }
    return skillId;
  }

  const studentNames = ["Phạm Gia Huy", "Đỗ Ngọc Linh", "Vũ Đức Minh", "Bùi Khánh An"];
  for (const [index, teamData] of teams.entries()) {
    const user = await prisma.user.upsert({
      where: { email: `student${index + 1}@unibridge.local` },
      update: {
        name: studentNames[index],
        passwordHash,
        role: "STUDENT",
      },
      create: {
        email: `student${index + 1}@unibridge.local`,
        name: studentNames[index],
        passwordHash,
        role: "STUDENT",
      },
    });
    const studentProfile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: { major: teamData.major, university: teamData.university },
      create: {
        userId: user.id,
        major: teamData.major,
        university: teamData.university,
      },
    });
    const team = await prisma.studentTeam.upsert({
      where: { slug: teamData.slug },
      update: {
        ownerId: user.id,
        name: teamData.name,
        university: teamData.university,
        description: teamData.description,
        experience: teamData.experience,
        relevantProducts: teamData.relevantProducts,
        achievements: teamData.achievements,
        interests: teamData.interests,
      },
      create: {
        ownerId: user.id,
        slug: teamData.slug,
        name: teamData.name,
        university: teamData.university,
        description: teamData.description,
        experience: teamData.experience,
        relevantProducts: teamData.relevantProducts,
        achievements: teamData.achievements,
        interests: teamData.interests,
      },
    });
    await prisma.teamMembership.upsert({
      where: {
        teamId_studentProfileId: {
          teamId: team.id,
          studentProfileId: studentProfile.id,
        },
      },
      update: {
        name: studentNames[index],
        major: teamData.major,
        title: "Trưởng nhóm",
        isLead: true,
      },
      create: {
        teamId: team.id,
        studentProfileId: studentProfile.id,
        name: studentNames[index],
        major: teamData.major,
        title: "Trưởng nhóm",
        isLead: true,
      },
    });
    await prisma.teamSkill.deleteMany({ where: { teamId: team.id } });
    await prisma.teamSkill.createMany({
      data: teamData.skills.map((name) => ({
        teamId: team.id,
        skillId: getSkillId(name),
      })),
    });
  }

  for (const [index, problemData] of problems.entries()) {
    const businessProfile = businessProfiles[problemData.businessIndex];
    if (!businessProfile) {
      throw new Error(`Không tìm thấy doanh nghiệp seed cho Problem: ${problemData.slug}`);
    }
    const problem = await prisma.problem.upsert({
      where: { slug: problemData.slug },
      update: {
        businessProfileId: businessProfile.id,
        reviewedById: admin.id,
        title: problemData.title,
        description: problemData.description,
        goal: problemData.goal,
        field: problemData.field,
        requirements: problemData.requirements,
        expectedDuration: problemData.expectedDuration,
        budgetMin: problemData.budgetMin,
        budgetMax: problemData.budgetMax,
        status: "APPROVED",
        reviewNote: "Đã kiểm duyệt nội dung mẫu.",
        approvedAt: new Date(),
      },
      create: {
        businessProfileId: businessProfile.id,
        reviewedById: admin.id,
        title: problemData.title,
        slug: problemData.slug,
        description: problemData.description,
        goal: problemData.goal,
        field: problemData.field,
        requirements: problemData.requirements,
        expectedDuration: problemData.expectedDuration,
        budgetMin: problemData.budgetMin,
        budgetMax: problemData.budgetMax,
        status: "APPROVED",
        reviewNote: "Đã kiểm duyệt nội dung mẫu.",
        approvedAt: new Date(Date.now() - index * 86_400_000),
      },
    });
    await prisma.problemSkill.deleteMany({ where: { problemId: problem.id } });
    await prisma.problemSkill.createMany({
      data: problemData.skills.map((name) => ({
        problemId: problem.id,
        skillId: getSkillId(name),
      })),
    });
  }

  const reviewExamples = [
    {
      slug: "ban-nhap-thu-nghiem-cua-doanh-nghiep",
      title: "Bản nháp bài toán đang soạn",
      status: "DRAFT",
      reviewNote: null,
    },
    {
      slug: "bai-toan-can-chinh-sua-thu-nghiem",
      title: "Bài toán mẫu cần chỉnh sửa",
      status: "NEEDS_REVISION",
      reviewNote: "Vui lòng làm rõ kết quả đầu ra và phạm vi dữ liệu cần phân tích.",
    },
    {
      slug: "bai-toan-cho-duyet-thu-nghiem",
      title: "Bài toán mẫu đang chờ duyệt",
      status: "PENDING_REVIEW",
      reviewNote: null,
    },
  ];
  for (const example of reviewExamples) {
    await prisma.problem.upsert({
      where: { slug: example.slug },
      update: {
        businessProfileId: businessProfiles[0].id,
        title: example.title,
        description: "Bài toán mẫu để doanh nghiệp kiểm thử trạng thái và luồng chỉnh sửa.",
        goal: "Kiểm tra chức năng lưu, cập nhật và gửi duyệt bài toán.",
        field: "Phân tích dữ liệu",
        requirements: "Nhóm có kinh nghiệm xử lý và trình bày dữ liệu.",
        expectedDuration: "4-6 tuần",
        budgetMin: 5000000,
        budgetMax: 10000000,
        status: example.status,
        reviewNote: example.reviewNote,
        reviewedById: null,
        approvedAt: null,
        submittedAt: example.status === "DRAFT" ? null : new Date(),
      },
      create: {
        businessProfileId: businessProfiles[0].id,
        title: example.title,
        slug: example.slug,
        description: "Bài toán mẫu để doanh nghiệp kiểm thử trạng thái và luồng chỉnh sửa.",
        goal: "Kiểm tra chức năng lưu, cập nhật và gửi duyệt bài toán.",
        field: "Phân tích dữ liệu",
        requirements: "Nhóm có kinh nghiệm xử lý và trình bày dữ liệu.",
        expectedDuration: "4-6 tuần",
        budgetMin: 5000000,
        budgetMax: 10000000,
        status: example.status,
        reviewNote: example.reviewNote,
        reviewedById: null,
        approvedAt: null,
        submittedAt: example.status === "DRAFT" ? null : new Date(),
      },
    });
  }

  const applicationProblem = await prisma.problem.findUniqueOrThrow({
    where: { slug: problems[0].slug },
  });
  await ensureSeedAttachment(
    applicationProblem.id,
    "seed-public-problem-attachment",
    "Tai-lieu-mau.csv",
    "text/csv",
    new TextEncoder().encode(
      "san_pham,mo_ta\nMat_hang_mau,Du_lieu_mau de xem tai lieu\n",
    ),
  );
  const pendingReviewProblem = await prisma.problem.findUniqueOrThrow({
    where: { slug: "bai-toan-cho-duyet-thu-nghiem" },
  });
  await ensureSeedAttachment(
    pendingReviewProblem.id,
    "seed-pending-problem-attachment",
    "Du-lieu-kiem-duyet.csv",
    "text/csv",
    new TextEncoder().encode(
      "hang_muc,mo_ta\nTai_lieu_kiem_duyet,Du_lieu mau cho admin tai xuong\n",
    ),
  );

  const applicationExamples = [
    {
      teamSlug: "nextgen-digital",
      approach:
        "Phỏng vấn doanh nghiệp, xác định luồng mua hàng chính, đề xuất cấu trúc website responsive và kiểm thử luồng với người dùng.",
      problemUnderstanding:
        "Doanh nghiệp thiếu kênh bán hàng trực tuyến thuận tiện để giới thiệu sản phẩm và nhận đơn.",
      solutionDirection:
        "Xây dựng website bán hàng ưu tiên thiết bị di động, tập trung vào danh mục, nguồn gốc và đặt hàng.",
      methodology: "Phỏng vấn doanh nghiệp, lập luồng người dùng và kiểm thử khả năng sử dụng.",
      keySteps: "Phân tích yêu cầu; thiết kế giao diện; xây dựng website; kiểm thử và bàn giao.",
      tools: "Next.js, TypeScript, Figma",
      resources: "Một thành viên phụ trách giao diện, một thành viên phát triển và một đại diện doanh nghiệp phản hồi.",
      estimatedDuration: "8 tuần",
      proposedBudget: 22000000,
    },
    {
      teamSlug: "data-spark",
      approach:
        "Ưu tiên phân tích dữ liệu sản phẩm, xác định chỉ số cần theo dõi và đề xuất cấu trúc dashboard bán hàng.",
      problemUnderstanding:
        "Thông tin sản phẩm và hiệu quả bán hàng hiện chưa được trình bày tập trung.",
      solutionDirection:
        "Phân tích dữ liệu bán hàng, xác định chỉ số chính và đề xuất dashboard thử nghiệm.",
      methodology: "Kiểm tra dữ liệu mẫu, phân tích mô tả và rà soát kết quả cùng doanh nghiệp.",
      keySteps: "Xác định chỉ số; làm sạch dữ liệu; dựng dashboard; kiểm tra khuyến nghị.",
      tools: "Python, pandas, Power BI",
      resources: "Cần bộ dữ liệu bán hàng mẫu đã ẩn thông tin nhạy cảm.",
      estimatedDuration: "10 tuần",
      proposedBudget: 18000000,
    },
    {
      teamSlug: "creative-lab",
      approach:
        "Nghiên cứu hành vi mua trên thiết bị di động, dựng hệ thống giao diện và bộ hình ảnh sản phẩm nhất quán.",
      problemUnderstanding:
        "Trải nghiệm thương hiệu và giao diện mua hàng chưa nhất quán giữa các kênh.",
      solutionDirection:
        "Thiết kế lại bộ giao diện và hình ảnh sản phẩm theo một hệ thống nhận diện thống nhất.",
      methodology: "Phân tích hiện trạng, xây dựng moodboard và thử nghiệm mẫu giao diện.",
      keySteps: "Khảo sát hiện trạng; đề xuất phong cách; thiết kế mẫu; lấy phản hồi và hoàn thiện.",
      tools: "Figma, Adobe Illustrator",
      resources: "Cần bộ nhận diện hiện tại và hình ảnh sản phẩm được phép sử dụng.",
      estimatedDuration: "7 tuần",
      proposedBudget: 16000000,
    },
    {
      teamSlug: "market-minds",
      approach:
        "Khảo sát khách hàng mục tiêu, đề xuất định vị gian hàng và thử nghiệm nội dung bán hàng cho nhóm sản phẩm chủ lực.",
      problemUnderstanding:
        "Doanh nghiệp cần hiểu nhu cầu khách hàng và cách giới thiệu sản phẩm hiệu quả trên kênh trực tuyến.",
      solutionDirection:
        "Nghiên cứu nhóm khách hàng mục tiêu và đề xuất thông điệp bán hàng dựa trên dữ liệu khảo sát.",
      methodology: "Khảo sát trực tuyến, phỏng vấn ngắn và tổng hợp kết quả theo phân khúc.",
      keySteps: "Thiết kế khảo sát; thu thập dữ liệu; phân tích; đề xuất thông điệp và thử nghiệm.",
      tools: "Google Forms, Google Sheets",
      resources: "Cần doanh nghiệp hỗ trợ tiếp cận một số khách hàng hiện tại.",
      estimatedDuration: "6 tuần",
      proposedBudget: 14000000,
    },
  ];

  for (const application of applicationExamples) {
    const team = await prisma.studentTeam.findUniqueOrThrow({
      where: { slug: application.teamSlug },
    });
    await prisma.application.upsert({
      where: {
        problemId_teamId: {
          problemId: applicationProblem.id,
          teamId: team.id,
        },
      },
      update: {
        approach: application.approach,
        problemUnderstanding: application.problemUnderstanding,
        solutionDirection: application.solutionDirection,
        methodology: application.methodology,
        keySteps: application.keySteps,
        tools: application.tools,
        resources: application.resources,
        estimatedDuration: application.estimatedDuration,
        proposedBudget: application.proposedBudget,
        status: "SUBMITTED",
      },
      create: {
        problemId: applicationProblem.id,
        teamId: team.id,
        approach: application.approach,
        problemUnderstanding: application.problemUnderstanding,
        solutionDirection: application.solutionDirection,
        methodology: application.methodology,
        keySteps: application.keySteps,
        tools: application.tools,
        resources: application.resources,
        estimatedDuration: application.estimatedDuration,
        proposedBudget: application.proposedBudget,
      },
    });
  }

  const firstStudent = await prisma.user.findUniqueOrThrow({
    where: { email: "student1@unibridge.local" },
  });
  const savedExample = await prisma.problem.findUniqueOrThrow({
    where: { slug: problems[1].slug },
  });
  await prisma.savedProblem.upsert({
    where: {
      userId_problemId: {
        userId: firstStudent.id,
        problemId: savedExample.id,
      },
    },
    update: {},
    create: { userId: firstStudent.id, problemId: savedExample.id },
  });
}

main()
  .catch((error: unknown) => {
    console.error("Seed dữ liệu thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
