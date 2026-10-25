import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  businessFeeRate,
  legacyPlatformFeeRate,
  studentFeeRate,
} from "../src/lib/project-config";
import { calculateProjectFinancialBreakdown } from "../src/lib/project-money";
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

async function ensureSeedProposalFile(
  proposalId: string,
  fileId: string,
  originalName: string,
  content: Uint8Array,
) {
  const existingFile = await prisma.proposalFile.findUnique({ where: { id: fileId } });
  if (existingFile) return;

  const storageKey = randomUUID();
  await attachmentStorage.save(storageKey, content);
  try {
    await prisma.proposalFile.create({
      data: {
        id: fileId,
        proposalId,
        originalName,
        contentType: "text/csv",
        sizeBytes: content.byteLength,
        storageKey,
      },
    });
  } catch (error) {
    try {
      await attachmentStorage.delete(storageKey);
    } catch (cleanupError) {
      console.error("Không thể dọn tệp Proposal seed sau lỗi tạo metadata:", cleanupError);
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
    ratingAverage: 4.7,
    ratingCount: 6,
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
    ratingAverage: 4.2,
    ratingCount: 3,
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
    ratingAverage: 4.8,
    ratingCount: 1,
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
    ratingAverage: 0,
    ratingCount: 0,
  },
];

async function createCompletedReviewSample({
  slug,
  title,
  teamSlug,
  businessProfile,
  businessUserId,
  businessScores,
  teamScores,
  daysAgo,
  late,
}: {
  slug: string;
  title: string;
  teamSlug: string;
  businessProfile: { id: string };
  businessUserId: string;
  businessScores: number[];
  teamScores: number[];
  daysAgo: number;
  late: boolean;
}) {
  const team = await prisma.studentTeam.findUniqueOrThrow({ where: { slug: teamSlug } });
  const problem = await prisma.problem.upsert({
    where: { slug },
    update: {
      businessProfileId: businessProfile.id,
      title,
      description: "Bài toán mẫu đã triển khai và nghiệm thu trên UniBridge.",
      goal: "Minh họa lịch sử dự án và đánh giá Reputation.",
      field: "Công nghệ thông tin",
      requirements: "Hoàn tất phạm vi, bàn giao kết quả và nghiệm thu Milestone.",
      expectedDuration: "4 tuần",
      budgetMin: 5000000,
      budgetMax: 5000000,
      status: "COMPLETED",
      approvedAt: new Date(),
    },
    create: {
      businessProfileId: businessProfile.id,
      reviewedById: null,
      title,
      slug,
      description: "Bài toán mẫu đã triển khai và nghiệm thu trên UniBridge.",
      goal: "Minh họa lịch sử dự án và đánh giá Reputation.",
      field: "Công nghệ thông tin",
      requirements: "Hoàn tất phạm vi, bàn giao kết quả và nghiệm thu Milestone.",
      expectedDuration: "4 tuần",
      budgetMin: 5000000,
      budgetMax: 5000000,
      status: "COMPLETED",
      approvedAt: new Date(),
    },
  });
  const application = await prisma.application.upsert({
    where: {
      problemId_teamId: { problemId: problem.id, teamId: team.id },
    },
    update: { status: "SELECTED" },
    create: {
      problemId: problem.id,
      teamId: team.id,
      approach: "Hoàn thành dự án mẫu để minh họa năng lực thực hiện.",
      estimatedDuration: "4 tuần",
      proposedBudget: 5000000,
      status: "SELECTED",
    },
  });
  const daysInMs = 86_400_000;
  const completedAt = new Date(Date.now() - daysAgo * daysInMs);
  const dueAt = new Date(completedAt.getTime() + (late ? -daysInMs : daysInMs));
  const milestoneId = `seed-review-milestone-${slug}`;
  const project = await prisma.project.upsert({
    where: { applicationId: application.id },
    update: {
      teamId: team.id,
      title,
      agreedScope: "Thực hiện và bàn giao theo các yêu cầu đã thống nhất.",
      deliverables: "Sản phẩm mẫu đã nghiệm thu.",
      duration: "4 tuần",
      totalAmount: 5000000,
      generalAcceptanceCriteria: "Bàn giao đầy đủ kết quả.",
      businessResponsibilities: "Cung cấp thông tin và phản hồi theo thỏa thuận.",
      teamResponsibilities: "Thực hiện và bàn giao đúng phạm vi.",
      paymentMethod: "Nạp giả lập một lần; giải ngân theo nghiệm thu Milestone.",
      status: "COMPLETED",
      startedAt: new Date(completedAt.getTime() - 28 * daysInMs),
      completedAt,
      cancelledAt: null,
    },
    create: {
      applicationId: application.id,
      teamId: team.id,
      title,
      agreedScope: "Thực hiện và bàn giao theo các yêu cầu đã thống nhất.",
      deliverables: "Sản phẩm mẫu đã nghiệm thu.",
      duration: "4 tuần",
      totalAmount: 5000000,
      generalAcceptanceCriteria: "Bàn giao đầy đủ kết quả.",
      businessResponsibilities: "Cung cấp thông tin và phản hồi theo thỏa thuận.",
      teamResponsibilities: "Thực hiện và bàn giao đúng phạm vi.",
      paymentMethod: "Nạp giả lập một lần; giải ngân theo nghiệm thu Milestone.",
      status: "COMPLETED",
      startedAt: new Date(completedAt.getTime() - 28 * daysInMs),
      completedAt,
    },
  });
  await prisma.milestone.upsert({
    where: { id: milestoneId },
    update: {
      projectId: project.id,
      title: "Bàn giao dự án mẫu",
      description: "Hoàn thành và bàn giao sản phẩm.",
      acceptanceCriteria: "Doanh nghiệp nghiệm thu sản phẩm.",
      paymentPercent: 100,
      amount: 5000000,
      dueAt,
      sortOrder: 0,
      status: "ACCEPTED",
      submittedAt: new Date(completedAt.getTime() - 60 * 60 * 1000),
      acceptedAt: completedAt,
    },
    create: {
      id: milestoneId,
      projectId: project.id,
      title: "Bàn giao dự án mẫu",
      description: "Hoàn thành và bàn giao sản phẩm.",
      acceptanceCriteria: "Doanh nghiệp nghiệm thu sản phẩm.",
      paymentPercent: 100,
      amount: 5000000,
      dueAt,
      sortOrder: 0,
      status: "ACCEPTED",
      submittedAt: new Date(completedAt.getTime() - 60 * 60 * 1000),
      acceptedAt: completedAt,
    },
  });
  await prisma.projectTransaction.upsert({
    where: { idempotencyKey: `deposit:${project.id}` },
    update: {
      projectId: project.id,
      type: "DEPOSIT",
      amount: 5000000,
      platformFee: 750000,
      platformFeeBasisPoints: legacyPlatformFeeRate,
      businessFeeBasisPoints: null,
      studentFeeBasisPoints: null,
      businessFee: null,
      status: "RELEASED",
      paidAt: completedAt,
    },
    create: {
      projectId: project.id,
      idempotencyKey: `deposit:${project.id}`,
      type: "DEPOSIT",
      amount: 5000000,
      platformFee: 750000,
      platformFeeBasisPoints: legacyPlatformFeeRate,
      businessFeeBasisPoints: null,
      studentFeeBasisPoints: null,
      businessFee: null,
      status: "RELEASED",
      paidAt: completedAt,
    },
  });
  await prisma.projectTransaction.upsert({
    where: { idempotencyKey: `release:${milestoneId}` },
    update: {
      projectId: project.id,
      milestoneId,
      type: "MILESTONE_RELEASE",
      amount: 4250000,
      platformFee: 750000,
      platformFeeBasisPoints: legacyPlatformFeeRate,
      businessFeeBasisPoints: null,
      studentFeeBasisPoints: null,
      businessFee: null,
      status: "RELEASED",
      paidAt: completedAt,
    },
    create: {
      projectId: project.id,
      milestoneId,
      idempotencyKey: `release:${milestoneId}`,
      type: "MILESTONE_RELEASE",
      amount: 4250000,
      platformFee: 750000,
      platformFeeBasisPoints: legacyPlatformFeeRate,
      businessFeeBasisPoints: null,
      studentFeeBasisPoints: null,
      businessFee: null,
      status: "RELEASED",
      paidAt: completedAt,
    },
  });

  const businessCriteria = [
    "resultQuality",
    "timeliness",
    "requirementFit",
    "collaboration",
    "professionalism",
  ];
  const teamCriteria = [
    "requirementClarity",
    "responseTime",
    "fairAcceptance",
    "cooperation",
  ];
  const createReview = async (
    direction: "BUSINESS_TO_TEAM" | "TEAM_TO_BUSINESS",
    reviewerId: string,
    scores: number[],
    criteria: string[],
  ) => {
    const criteriaScores = Object.fromEntries(
      criteria.map((key, index) => [key, scores[index] ?? 3]),
    );
    const rating =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;
    await prisma.review.upsert({
      where: { projectId_direction: { projectId: project.id, direction } },
      update: {
        reviewerId,
        reviewedTeamId: direction === "BUSINESS_TO_TEAM" ? team.id : null,
        reviewedBusinessProfileId:
          direction === "TEAM_TO_BUSINESS" ? businessProfile.id : null,
        rating,
        criteriaScores: JSON.stringify(criteriaScores),
        content:
          direction === "BUSINESS_TO_TEAM"
            ? "Nhóm phối hợp tốt và bàn giao theo phạm vi đã thống nhất."
            : "Doanh nghiệp trao đổi rõ ràng và phản hồi trong thời gian phù hợp.",
        createdAt: new Date(completedAt.getTime() + 2 * 60 * 60 * 1000),
      },
      create: {
        projectId: project.id,
        reviewerId,
        direction,
        reviewedTeamId: direction === "BUSINESS_TO_TEAM" ? team.id : null,
        reviewedBusinessProfileId:
          direction === "TEAM_TO_BUSINESS" ? businessProfile.id : null,
        rating,
        criteriaScores: JSON.stringify(criteriaScores),
        content:
          direction === "BUSINESS_TO_TEAM"
            ? "Nhóm phối hợp tốt và bàn giao theo phạm vi đã thống nhất."
            : "Doanh nghiệp trao đổi rõ ràng và phản hồi trong thời gian phù hợp.",
        createdAt: new Date(completedAt.getTime() + 2 * 60 * 60 * 1000),
      },
    });
  };
  await createReview("BUSINESS_TO_TEAM", businessUserId, businessScores, businessCriteria);
  if (team.ownerId && teamScores.length > 0) {
    await createReview("TEAM_TO_BUSINESS", team.ownerId, teamScores, teamCriteria);
  }

  return { teamId: team.id, projectId: project.id };
}

async function ensureNotImplementedHistory({
  slug,
  teamSlug,
  businessProfileId,
}: {
  slug: string;
  teamSlug: string;
  businessProfileId: string;
}) {
  const team = await prisma.studentTeam.findUniqueOrThrow({ where: { slug: teamSlug } });
  const problem = await prisma.problem.upsert({
    where: { slug },
    update: { businessProfileId, status: "CLOSED" },
    create: {
      businessProfileId,
      title: "Bài toán mẫu không triển khai",
      slug,
      description: "Lưu lịch sử Proposal đã kết thúc mà không triển khai Paid Implementation.",
      goal: "Minh họa trường hợp không triển khai.",
      field: "Công nghệ thông tin",
      requirements: "Đánh giá phương án trước khi quyết định triển khai.",
      expectedDuration: "3 tuần",
      status: "CLOSED",
    },
  });
  const application = await prisma.application.upsert({
    where: { problemId_teamId: { problemId: problem.id, teamId: team.id } },
    update: { status: "SELECTED" },
    create: {
      problemId: problem.id,
      teamId: team.id,
      approach: "Nhóm đã gửi Proposal được doanh nghiệp đánh giá.",
      estimatedDuration: "3 tuần",
      status: "SELECTED",
    },
  });
  const proposal = await prisma.proposal.upsert({
    where: { applicationId_version: { applicationId: application.id, version: 1 } },
    update: { status: "NOT_IMPLEMENTED" },
    create: {
      applicationId: application.id,
      version: 1,
      type: "SOLUTION_PROPOSAL",
      description: "Proposal mẫu kết thúc với quyết định không triển khai.",
      status: "NOT_IMPLEMENTED",
    },
  });
  const evaluation = await prisma.proposalEvaluation.findFirst({
    where: { proposalId: proposal.id },
    select: { id: true },
  });
  const evaluationData = {
    problemResponse: 3,
    feasibility: 3,
    goalAlignment: 3,
    practicalImplementation: 3,
    estimatedCost: 3,
    implementationTime: 3,
    valueDelivered: 3,
    comment: "Phương án được lưu trong lịch sử; doanh nghiệp quyết định chưa triển khai.",
    decision: "CLOSED",
  };
  if (evaluation) {
    await prisma.proposalEvaluation.update({
      where: { id: evaluation.id },
      data: evaluationData,
    });
  } else {
    await prisma.proposalEvaluation.create({
      data: { proposalId: proposal.id, ...evaluationData },
    });
  }
}

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
        ratingAverage: teamData.ratingAverage,
        ratingCount: teamData.ratingCount,
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
        ratingAverage: teamData.ratingAverage,
        ratingCount: teamData.ratingCount,
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
    {
      slug: "bai-toan-bi-tu-choi-thu-nghiem",
      title: "Bài toán mẫu bị từ chối",
      status: "REJECTED",
      reviewNote: "Mô tả chưa đủ căn cứ và thiếu thông tin cần thiết để công khai.",
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
        reviewedById: example.status === "REJECTED" ? admin.id : null,
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
        reviewedById: example.status === "REJECTED" ? admin.id : null,
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

  const invitationStates = [
    { teamSlug: "nextgen-digital", status: "PENDING_CONFIRMATION", days: 5 },
    { teamSlug: "market-minds", status: "DECLINED", days: -1 },
    { teamSlug: "data-spark", status: "EXPIRED", days: -1 },
  ] as const;
  for (const state of invitationStates) {
    const team = await prisma.studentTeam.findUniqueOrThrow({
      where: { slug: state.teamSlug },
    });
    const application = await prisma.application.findUniqueOrThrow({
      where: { problemId_teamId: { problemId: applicationProblem.id, teamId: team.id } },
    });
    const existingInvitation = await prisma.applicationInvitation.findFirst({
      where: { applicationId: application.id, status: state.status },
    });
    if (!existingInvitation) {
      const invitedAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      await prisma.applicationInvitation.create({
        data: {
          applicationId: application.id,
          problemId: applicationProblem.id,
          teamId: team.id,
          invitedByBusinessProfileId: applicationProblem.businessProfileId,
          status: state.status,
          invitedAt,
          expiresAt: new Date(Date.now() + state.days * 24 * 60 * 60 * 1000),
          respondedAt: state.status === "PENDING_CONFIRMATION" ? null : new Date(),
          responseStatus: state.status,
          responseReason:
            state.status === "DECLINED"
              ? "Nhóm không sắp xếp được thời gian."
              : state.status === "EXPIRED"
                ? "Hết hạn phản hồi"
                : null,
        },
      });
    }
    await prisma.application.update({
      where: { id: application.id },
      data: { status: state.status },
    });
  }

  const prototypingProblem = await prisma.problem.findUniqueOrThrow({
    where: { slug: problems[0].slug },
  });
  const prototypingSelectedTeam = await prisma.studentTeam.findUniqueOrThrow({
    where: { slug: "nextgen-digital" },
  });
  if (!prototypingSelectedTeam.ownerId) {
    throw new Error("Nhóm seed không có chủ sở hữu: nextgen-digital");
  }
  const prototypingApplication = await prisma.application.findUniqueOrThrow({
    where: {
      problemId_teamId: {
        problemId: prototypingProblem.id,
        teamId: prototypingSelectedTeam.id,
      },
    },
  });
  await prisma.application.update({
    where: { id: prototypingApplication.id },
    data: { status: "SELECTED" },
  });
  await prisma.application.updateMany({
    where: {
      problemId: prototypingProblem.id,
      id: { not: prototypingApplication.id },
      status: "SUBMITTED",
    },
    data: { status: "REJECTED" },
  });
  await prisma.problem.update({
    where: { id: prototypingProblem.id },
    data: { status: "PROTOTYPING" },
  });

  const evaluationBusiness = businessProfiles[1];
  if (!evaluationBusiness) throw new Error("Thiếu doanh nghiệp seed cho Proposal.");
  const evaluationProblem = await prisma.problem.upsert({
    where: { slug: "de-xuat-dashboard-phan-tich-ban-hang" },
    update: {
      businessProfileId: evaluationBusiness.id,
      title: "Đề xuất dashboard phân tích bán hàng",
      description: "Doanh nghiệp cần tổng hợp dữ liệu bán hàng để theo dõi hiệu quả theo kênh.",
      goal: "Có góc nhìn rõ ràng về doanh thu, sản phẩm và xu hướng theo thời gian.",
      field: "Phân tích dữ liệu",
      requirements: "Nhóm đề xuất mô hình dashboard và các chỉ số ưu tiên.",
      expectedDuration: "5-7 tuần",
      budgetMin: 10000000,
      budgetMax: 20000000,
      status: "EVALUATING",
      approvedAt: new Date(),
    },
    create: {
      businessProfileId: evaluationBusiness.id,
      reviewedById: admin.id,
      title: "Đề xuất dashboard phân tích bán hàng",
      slug: "de-xuat-dashboard-phan-tich-ban-hang",
      description: "Doanh nghiệp cần tổng hợp dữ liệu bán hàng để theo dõi hiệu quả theo kênh.",
      goal: "Có góc nhìn rõ ràng về doanh thu, sản phẩm và xu hướng theo thời gian.",
      field: "Phân tích dữ liệu",
      requirements: "Nhóm đề xuất mô hình dashboard và các chỉ số ưu tiên.",
      expectedDuration: "5-7 tuần",
      budgetMin: 10000000,
      budgetMax: 20000000,
      status: "EVALUATING",
      approvedAt: new Date(),
    },
  });
  const evaluationTeam = await prisma.studentTeam.findUniqueOrThrow({
    where: { slug: "data-spark" },
  });
  if (!evaluationTeam.ownerId) {
    throw new Error("Nhóm seed không có chủ sở hữu: data-spark");
  }
  const evaluationApplication = await prisma.application.upsert({
    where: {
      problemId_teamId: {
        problemId: evaluationProblem.id,
        teamId: evaluationTeam.id,
      },
    },
    update: {
      approach: "Phân tích dữ liệu bán hàng, xác định chỉ số chính và đề xuất dashboard thử nghiệm.",
      problemUnderstanding: "Dữ liệu hiện phân tán, gây khó khăn khi so sánh hiệu quả giữa các kênh.",
      solutionDirection: "Tạo dashboard thử nghiệm theo doanh thu, sản phẩm và kênh bán.",
      methodology: "Rà soát dữ liệu mẫu, xây dựng chỉ số và kiểm tra trực quan hóa.",
      keySteps: "Kiểm tra dữ liệu; chọn KPI; dựng bản mẫu; rà soát cùng doanh nghiệp.",
      tools: "Python, Power BI",
      resources: "Cần bộ dữ liệu mẫu đã ẩn thông tin cá nhân.",
      estimatedDuration: "6 tuần",
      proposedBudget: 15000000,
      status: "SELECTED",
    },
    create: {
      problemId: evaluationProblem.id,
      teamId: evaluationTeam.id,
      approach: "Phân tích dữ liệu bán hàng, xác định chỉ số chính và đề xuất dashboard thử nghiệm.",
      problemUnderstanding: "Dữ liệu hiện phân tán, gây khó khăn khi so sánh hiệu quả giữa các kênh.",
      solutionDirection: "Tạo dashboard thử nghiệm theo doanh thu, sản phẩm và kênh bán.",
      methodology: "Rà soát dữ liệu mẫu, xây dựng chỉ số và kiểm tra trực quan hóa.",
      keySteps: "Kiểm tra dữ liệu; chọn KPI; dựng bản mẫu; rà soát cùng doanh nghiệp.",
      tools: "Python, Power BI",
      resources: "Cần bộ dữ liệu mẫu đã ẩn thông tin cá nhân.",
      estimatedDuration: "6 tuần",
      proposedBudget: 15000000,
      status: "SELECTED",
    },
  });
  const evaluationProposal = await prisma.proposal.upsert({
    where: {
      applicationId_version: {
        applicationId: evaluationApplication.id,
        version: 1,
      },
    },
    update: {
      type: "DATA_ANALYSIS",
      description: "Bản đề xuất gồm bộ KPI bán hàng, bố cục dashboard và dữ liệu mẫu minh họa.",
      status: "SUBMITTED",
    },
    create: {
      applicationId: evaluationApplication.id,
      version: 1,
      type: "DATA_ANALYSIS",
      description: "Bản đề xuất gồm bộ KPI bán hàng, bố cục dashboard và dữ liệu mẫu minh họa.",
      status: "SUBMITTED",
    },
  });
  await ensureSeedProposalFile(
    evaluationProposal.id,
    "seed-evaluation-proposal-file",
    "De-xuat-dashboard.csv",
    new TextEncoder().encode("chi_so,mo_ta\nDoanh thu,Doanh thu theo thoi gian\n"),
  );

  const projectBusiness = businessProfiles[2];
  if (!projectBusiness) throw new Error("Thiếu doanh nghiệp seed cho Paid Implementation.");
  const projectProblem = await prisma.problem.upsert({
    where: { slug: "du-an-mau-paid-implementation" },
    update: {
      businessProfileId: projectBusiness.id,
      title: "Xây dựng trang giới thiệu du lịch cộng đồng",
      description: "Doanh nghiệp cần một trải nghiệm giới thiệu tour trên thiết bị di động.",
      goal: "Giúp khách tìm hiểu lịch trình và gửi yêu cầu tư vấn.",
      field: "Công nghệ thông tin",
      requirements: "Thiết kế responsive, trình bày lịch trình và biểu mẫu liên hệ.",
      expectedDuration: "6 tuần",
      budgetMin: 10000000,
      budgetMax: 12000000,
      status: "READY_FOR_IMPLEMENTATION",
      approvedAt: new Date(),
    },
    create: {
      businessProfileId: projectBusiness.id,
      reviewedById: admin.id,
      title: "Xây dựng trang giới thiệu du lịch cộng đồng",
      slug: "du-an-mau-paid-implementation",
      description: "Doanh nghiệp cần một trải nghiệm giới thiệu tour trên thiết bị di động.",
      goal: "Giúp khách tìm hiểu lịch trình và gửi yêu cầu tư vấn.",
      field: "Công nghệ thông tin",
      requirements: "Thiết kế responsive, trình bày lịch trình và biểu mẫu liên hệ.",
      expectedDuration: "6 tuần",
      budgetMin: 10000000,
      budgetMax: 12000000,
      status: "READY_FOR_IMPLEMENTATION",
      approvedAt: new Date(),
    },
  });
  const projectTeam = await prisma.studentTeam.findUniqueOrThrow({
    where: { slug: "creative-lab" },
  });
  const projectApplication = await prisma.application.upsert({
    where: {
      problemId_teamId: {
        problemId: projectProblem.id,
        teamId: projectTeam.id,
      },
    },
    update: { status: "SELECTED" },
    create: {
      problemId: projectProblem.id,
      teamId: projectTeam.id,
      approach: "Thiết kế giao diện di động và luồng đăng ký tư vấn tour.",
      estimatedDuration: "6 tuần",
      proposedBudget: 10000001,
      status: "SELECTED",
    },
  });
  await prisma.application.updateMany({
    where: {
      problemId: projectProblem.id,
      id: { not: projectApplication.id },
      status: "SELECTED",
    },
    data: { status: "REJECTED" },
  });
  const projectTotalAmount = 10_000_001;
  const projectMilestonePercents = [33, 33, 34];
  const projectBreakdown = calculateProjectFinancialBreakdown(
    projectTotalAmount,
    projectMilestonePercents,
    businessFeeRate,
    studentFeeRate,
  );
  const project = await prisma.project.upsert({
    where: { applicationId: projectApplication.id },
    update: {
      teamId: projectTeam.id,
      title: "Trang giới thiệu du lịch cộng đồng",
      agreedScope: "Thiết kế và triển khai trang giới thiệu tour responsive.",
      deliverables: "Bộ giao diện, trang giới thiệu tour và biểu mẫu liên hệ.",
      duration: "6 tuần",
      totalAmount: projectTotalAmount,
      generalAcceptanceCriteria: "Trang hoạt động trên điện thoại và máy tính.",
      businessResponsibilities: "Cung cấp nội dung tour và phản hồi trong 3 ngày làm việc.",
      teamResponsibilities: "Cập nhật tiến độ và bàn giao sản phẩm theo Milestone.",
      paymentMethod: "Nạp giả lập một lần; giải ngân theo nghiệm thu Milestone.",
      agreementRevision: 1,
      businessAcceptedAt: new Date(),
      teamAcceptedAt: new Date(),
      status: "IN_PROGRESS",
      startedAt: new Date(),
      completedAt: null,
      cancelledAt: null,
    },
    create: {
      applicationId: projectApplication.id,
      teamId: projectTeam.id,
      title: "Trang giới thiệu du lịch cộng đồng",
      agreedScope: "Thiết kế và triển khai trang giới thiệu tour responsive.",
      deliverables: "Bộ giao diện, trang giới thiệu tour và biểu mẫu liên hệ.",
      duration: "6 tuần",
      totalAmount: projectTotalAmount,
      generalAcceptanceCriteria: "Trang hoạt động trên điện thoại và máy tính.",
      businessResponsibilities: "Cung cấp nội dung tour và phản hồi trong 3 ngày làm việc.",
      teamResponsibilities: "Cập nhật tiến độ và bàn giao sản phẩm theo Milestone.",
      paymentMethod: "Nạp giả lập một lần; giải ngân theo nghiệm thu Milestone.",
      agreementRevision: 1,
      businessAcceptedAt: new Date(),
      teamAcceptedAt: new Date(),
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });
  const milestoneSeed = [
    {
      id: "seed-paid-milestone-1",
      title: "Chốt nội dung và cấu trúc trang",
      description: "Hoàn thiện sitemap và nội dung chính của trang giới thiệu.",
      acceptanceCriteria: "Doanh nghiệp xác nhận sitemap và nội dung các trang chính.",
    },
    {
      id: "seed-paid-milestone-2",
      title: "Thiết kế giao diện responsive",
      description: "Thiết kế giao diện trang chủ và trang chi tiết tour.",
      acceptanceCriteria: "Bản thiết kế hiển thị đúng trên kích thước điện thoại và máy tính.",
    },
    {
      id: "seed-paid-milestone-3",
      title: "Hoàn thiện và bàn giao",
      description: "Tích hợp giao diện, biểu mẫu tư vấn và tài liệu hướng dẫn.",
      acceptanceCriteria: "Biểu mẫu hoạt động và doanh nghiệp xác nhận bàn giao.",
    },
  ];
  const milestoneIds: string[] = [];
  for (const [index, details] of milestoneSeed.entries()) {
    milestoneIds.push(details.id);
    await prisma.milestone.upsert({
      where: { id: details.id },
      update: {
        projectId: project.id,
        ...details,
        paymentPercent: projectMilestonePercents[index] ?? 0,
        amount: projectBreakdown.milestones[index]?.grossAmount ?? 0,
        dueAt: new Date(Date.now() + (index + 1) * 14 * 86_400_000),
        sortOrder: index,
        status: index === 0 ? "ACCEPTED" : index === 1 ? "IN_PROGRESS" : "PENDING",
        submittedAt: index === 0 ? new Date() : null,
        acceptedAt: index === 0 ? new Date() : null,
        progressNote: index === 1 ? "Đang dựng bố cục giao diện trên thiết bị di động." : null,
        revisionFeedback: null,
      },
      create: {
        projectId: project.id,
        ...details,
        paymentPercent: projectMilestonePercents[index] ?? 0,
        amount: projectBreakdown.milestones[index]?.grossAmount ?? 0,
        dueAt: new Date(Date.now() + (index + 1) * 14 * 86_400_000),
        sortOrder: index,
        status: index === 0 ? "ACCEPTED" : index === 1 ? "IN_PROGRESS" : "PENDING",
        submittedAt: index === 0 ? new Date() : null,
        acceptedAt: index === 0 ? new Date() : null,
        progressNote: index === 1 ? "Đang dựng bố cục giao diện trên thiết bị di động." : null,
      },
    });
  }
  await prisma.projectTransaction.upsert({
    where: { idempotencyKey: `deposit:${project.id}` },
    update: {
      projectId: project.id,
      type: "DEPOSIT",
      amount: projectBreakdown.totalDeposit,
      platformFee: projectBreakdown.totalPlatformFee,
      platformFeeBasisPoints: projectBreakdown.platformFeeBasisPoints,
      businessFeeBasisPoints: businessFeeRate,
      studentFeeBasisPoints: studentFeeRate,
      businessFee: projectBreakdown.totalBusinessFee,
      status: "ESCROW",
      paidAt: new Date(),
    },
    create: {
      projectId: project.id,
      idempotencyKey: `deposit:${project.id}`,
      type: "DEPOSIT",
      amount: projectBreakdown.totalDeposit,
      platformFee: projectBreakdown.totalPlatformFee,
      platformFeeBasisPoints: projectBreakdown.platformFeeBasisPoints,
      businessFeeBasisPoints: businessFeeRate,
      studentFeeBasisPoints: studentFeeRate,
      businessFee: projectBreakdown.totalBusinessFee,
      status: "ESCROW",
      paidAt: new Date(),
    },
  });
  const firstMilestoneAllocation = projectBreakdown.milestones[0];
  const firstMilestoneId = milestoneIds[0];
  if (!firstMilestoneAllocation || !firstMilestoneId) {
    throw new Error("Thiếu phân bổ Milestone mẫu.");
  }
  await prisma.projectTransaction.upsert({
    where: { idempotencyKey: `release:${firstMilestoneId}` },
    update: {
      projectId: project.id,
      milestoneId: firstMilestoneId,
      type: "MILESTONE_RELEASE",
      amount: firstMilestoneAllocation.teamAmount,
      platformFee: firstMilestoneAllocation.studentFee,
      platformFeeBasisPoints: studentFeeRate,
      businessFeeBasisPoints: businessFeeRate,
      studentFeeBasisPoints: studentFeeRate,
      businessFee: firstMilestoneAllocation.businessFee,
      status: "RELEASED",
      paidAt: new Date(),
    },
    create: {
      projectId: project.id,
      milestoneId: firstMilestoneId,
      idempotencyKey: `release:${firstMilestoneId}`,
      type: "MILESTONE_RELEASE",
      amount: firstMilestoneAllocation.teamAmount,
      platformFee: firstMilestoneAllocation.studentFee,
      platformFeeBasisPoints: studentFeeRate,
      businessFeeBasisPoints: businessFeeRate,
      studentFeeBasisPoints: studentFeeRate,
      businessFee: firstMilestoneAllocation.businessFee,
      status: "RELEASED",
      paidAt: new Date(),
    },
  });

  const reputationSamples = [
    {
      slug: "seed-reputation-nextgen-1",
      title: "Phân tích trải nghiệm mua hàng mẫu",
      teamSlug: "nextgen-digital",
      businessIndex: 1,
      businessScores: [5, 5, 5, 5, 4],
      teamScores: [5, 4, 4, 5],
      daysAgo: 60,
      late: false,
    },
    {
      slug: "seed-reputation-nextgen-2",
      title: "Tối ưu quy trình đặt hàng mẫu",
      teamSlug: "nextgen-digital",
      businessIndex: 0,
      businessScores: [4, 5, 4, 5, 4],
      teamScores: [4, 4, 5, 4],
      daysAgo: 30,
      late: false,
    },
    {
      slug: "seed-reputation-market-minds",
      title: "Nghiên cứu khách hàng mẫu",
      teamSlug: "market-minds",
      businessIndex: 2,
      businessScores: [3, 4, 3, 4, 3],
      teamScores: [4, 3, 4, 4],
      daysAgo: 45,
      late: true,
    },
    {
      slug: "seed-reputation-data-spark",
      title: "Báo cáo dữ liệu kinh doanh mẫu",
      teamSlug: "data-spark",
      businessIndex: 1,
      businessScores: [4, 4, 5, 4, 4],
      teamScores: [3, 4, 4, 3],
      daysAgo: 20,
      late: false,
    },
    {
      slug: "seed-reputation-creative-lab",
      title: "Thiết kế nhận diện số mẫu",
      teamSlug: "creative-lab",
      businessIndex: 0,
      businessScores: [5, 5, 5, 5, 5],
      teamScores: [5, 5, 4, 5],
      daysAgo: 15,
      late: false,
    },
  ];
  for (const sample of reputationSamples) {
    const businessProfile = businessProfiles[sample.businessIndex];
    if (!businessProfile) throw new Error("Thiếu doanh nghiệp cho đánh giá seed.");
    await createCompletedReviewSample({
      ...sample,
      businessProfile,
      businessUserId: businessProfile.userId,
    });
  }
  const notImplementedBusiness = businessProfiles[2];
  if (!notImplementedBusiness) throw new Error("Thiếu doanh nghiệp cho lịch sử không triển khai.");
  await ensureNotImplementedHistory({
    slug: "seed-khong-trien-khai-reputation-history",
    teamSlug: "market-minds",
    businessProfileId: notImplementedBusiness.id,
  });
  for (const team of await prisma.studentTeam.findMany({ select: { id: true } })) {
    const aggregate = await prisma.review.aggregate({
      where: { reviewedTeamId: team.id, direction: "BUSINESS_TO_TEAM" },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.studentTeam.update({
      where: { id: team.id },
      data: {
        ratingAverage: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count._all,
      },
    });
  }

  const agreementTestProblem = await prisma.problem.upsert({
    where: { slug: "kiem-thu-thoa-thuan-paid-implementation" },
    update: {
      businessProfileId: businessProfiles[0].id,
      title: "Bài toán mẫu để kiểm thử thỏa thuận Paid Implementation",
      description: "Bài toán seed dành riêng để thử đề nghị, chỉnh sửa và hủy thỏa thuận.",
      goal: "Kiểm thử vòng đời thỏa thuận trước khi nạp tiền.",
      field: "Công nghệ thông tin",
      requirements: "Hai bên thống nhất phạm vi, sản phẩm và Milestone.",
      expectedDuration: "4 tuần",
      budgetMin: 5000000,
      budgetMax: 10000000,
      status: "READY_FOR_IMPLEMENTATION",
      approvedAt: new Date(),
    },
    create: {
      businessProfileId: businessProfiles[0].id,
      reviewedById: admin.id,
      title: "Bài toán mẫu để kiểm thử thỏa thuận Paid Implementation",
      slug: "kiem-thu-thoa-thuan-paid-implementation",
      description: "Bài toán seed dành riêng để thử đề nghị, chỉnh sửa và hủy thỏa thuận.",
      goal: "Kiểm thử vòng đời thỏa thuận trước khi nạp tiền.",
      field: "Công nghệ thông tin",
      requirements: "Hai bên thống nhất phạm vi, sản phẩm và Milestone.",
      expectedDuration: "4 tuần",
      budgetMin: 5000000,
      budgetMax: 10000000,
      status: "READY_FOR_IMPLEMENTATION",
      approvedAt: new Date(),
    },
  });
  const agreementTestTeam = await prisma.studentTeam.findUniqueOrThrow({
    where: { slug: "nextgen-digital" },
  });
  await prisma.application.upsert({
    where: {
      problemId_teamId: {
        problemId: agreementTestProblem.id,
        teamId: agreementTestTeam.id,
      },
    },
    update: { status: "SELECTED" },
    create: {
      problemId: agreementTestProblem.id,
      teamId: agreementTestTeam.id,
      approach: "Kiểm thử thỏa thuận, sửa điều khoản và thanh toán giả lập theo Milestone.",
      estimatedDuration: "4 tuần",
      proposedBudget: 8000000,
      status: "SELECTED",
    },
  });

  const sampleMessages = [
    {
      id: "seed-prototyping-message-1",
      problemId: prototypingProblem.id,
      senderId: prototypingSelectedTeam.ownerId,
      content: "Nhóm đã rà soát luồng mua hàng hiện tại. Doanh nghiệp có thể chia sẻ thứ tự ưu tiên giữa thanh toán và nhận đơn không?",
    },
    {
      id: "seed-prototyping-message-2",
      problemId: prototypingProblem.id,
      senderId: evaluationBusiness.userId,
      content: "Ưu tiên nhận đơn trên điện thoại trước; thanh toán trực tuyến có thể để ở giai đoạn sau.",
    },
    {
      id: "seed-evaluating-message-1",
      problemId: evaluationProblem.id,
      senderId: evaluationTeam.ownerId,
      content: "Nhóm đã nộp bản đề xuất ban đầu. Các chỉ số có thể điều chỉnh theo dữ liệu doanh nghiệp cung cấp.",
    },
  ];
  for (const message of sampleMessages) {
    await prisma.workspaceMessage.upsert({
      where: { id: message.id },
      update: message,
      create: message,
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

  const recommendationActivity = [
    {
      teamSlug: "nextgen-digital",
      viewedSlugs: ["so-hoa-quy-trinh-dat-tour"],
      savedSlugs: ["nhan-dien-thuong-hieu-an-nhien"],
      searches: [
        { query: "ứng dụng web", field: "Công nghệ thông tin", skill: "Next.js" },
      ],
    },
    {
      teamSlug: "market-minds",
      viewedSlugs: ["chien-dich-du-lich-mua-thap-diem"],
      savedSlugs: ["chien-dich-du-lich-mua-thap-diem"],
      searches: [
        { query: "nghiên cứu thị trường", field: "Marketing", skill: "Nghiên cứu thị trường" },
      ],
    },
    {
      teamSlug: "data-spark",
      viewedSlugs: ["dashboard-theo-doi-hieu-qua-kinh-doanh"],
      savedSlugs: ["phan-tich-hanh-vi-khach-hang"],
      searches: [
        { query: "phân tích dữ liệu", field: "Phân tích dữ liệu", skill: "Python" },
      ],
    },
    {
      teamSlug: "creative-lab",
      viewedSlugs: ["bo-nhan-dien-so-du-lich-cong-dong"],
      savedSlugs: ["nhan-dien-thuong-hieu-an-nhien"],
      searches: [
        { query: "thiết kế thương hiệu", field: "Thiết kế", skill: "Thiết kế đồ họa" },
      ],
    },
  ];

  for (const activity of recommendationActivity) {
    const team = await prisma.studentTeam.findUniqueOrThrow({
      where: { slug: activity.teamSlug },
      select: { ownerId: true },
    });
    if (!team.ownerId) {
      throw new Error(`Nhóm seed không có chủ sở hữu: ${activity.teamSlug}`);
    }
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: team.ownerId },
      select: { id: true },
    });

    for (const slug of activity.viewedSlugs) {
      const problem = await prisma.problem.findUniqueOrThrow({ where: { slug } });
      const id = `recommendation-view-${activity.teamSlug}-${slug}`;
      await prisma.viewLog.upsert({
        where: { id },
        update: { userId: user.id, problemId: problem.id },
        create: { id, userId: user.id, problemId: problem.id },
      });
    }
    for (const slug of activity.savedSlugs) {
      const problem = await prisma.problem.findUniqueOrThrow({ where: { slug } });
      await prisma.savedProblem.upsert({
        where: { userId_problemId: { userId: user.id, problemId: problem.id } },
        update: {},
        create: { userId: user.id, problemId: problem.id },
      });
    }
    for (const [index, search] of activity.searches.entries()) {
      const id = `recommendation-search-${activity.teamSlug}-${index}`;
      await prisma.searchLog.upsert({
        where: { id },
        update: {
          userId: user.id,
          query: search.query,
          field: search.field,
          skill: search.skill,
        },
        create: { id, userId: user.id, ...search },
      });
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error("Seed dữ liệu thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
