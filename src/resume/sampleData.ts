// The 22 sample personas from reference/resume_templates_reference.py (FIN, SWE, STU, DES, ACA, GOV, CONS ... TA), as resume
// content. Used for the template gallery and previews, and for "Fill with example" in each section form. Text is
// copied exactly; dates are stored as '2021' / '2025-06' with `current` for "Present".
import type { Education, Experience, Project, ResumeContent } from './types';
import { emptyContent, newId } from './types';

export type PersonaId =
  | 'finance' | 'software' | 'student' | 'designer' | 'academic' | 'government'
  | 'consultant'
  | 'manager'
  | 'director'
  | 'lawyer'
  | 'doctor'
  | 'engineer'
  | 'teacher'
  | 'marketing'
  | 'artist'
  | 'school-leaver'
  | 'scholarship'
  | 'first-job'
  | 'graduate'
  | 'research-assistant'
  | 'volunteer'
  | 'teaching-assistant';

const job = (role: string, company: string, city: string, start: string, end: string, bullets: string[]): Experience => ({
  id: newId(), role, company, city, start, end: end === 'Present' ? '' : end, current: end === 'Present', bullets,
});

const school = (degree: string, name: string, start: string, end: string, details: string): Education => ({
  id: newId(), degree, school: name, start, end, current: false, details,
});

const project = (name: string, description: string): Project => ({ id: newId(), name, description });

/** Fresh copies every call (new entry ids), so filling a form never shares entries with another resume. */
const PERSONAS: Record<PersonaId, () => ResumeContent> = {
  // Hamza Ali, Senior Financial Analyst
  finance: () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Hamza Ali', jobTitle: 'Senior Financial Analyst', email: 'hamza.ali@example.com', phone: '+92 300 1234567',
      city: 'Lahore, Pakistan', link: 'linkedin.com/in/hamzaali',
    },
    summary:
      'Financial analyst with 7 years of experience in budgeting, forecasting and reporting for retail and FMCG companies. Cut month-end reporting time by 40% by automating closing in Power BI.',
    experience: [
      job('Senior Financial Analyst', 'Nova Retail Group', 'Lahore', '2021', 'Present', [
        'Own the PKR 4.2B annual budget across 38 stores', 'Built Power BI dashboards used by 12 department heads', 'Cut month-end close from 9 days to 5',
      ]),
      job('Financial Analyst', 'Crescent Foods', 'Karachi', '2018', '2021', [
        'Prepared monthly variance reports for leadership', 'Supported two audits with no major findings',
      ]),
    ],
    education: [
      school('ACCA', 'Association of Chartered Certified Accountants', '', '2019', 'All 13 papers passed'),
      school('BBA (Hons) Finance', 'University of the Punjab, Lahore', '2014', '2018', 'CGPA 3.6 / 4.0'),
    ],
    skills: ['Financial modeling', 'Budgeting and forecasting', 'Power BI', 'Advanced Excel', 'SAP FICO', 'IFRS reporting'],
    languages: ['English (fluent)', 'Urdu (native)'],
    certifications: ['ACCA Member, 2019', 'Microsoft Power BI Data Analyst, 2022'],
  }),

  // Ayesha Khan, Software Engineer
  software: () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Ayesha Khan', jobTitle: 'Software Engineer', email: 'ayesha.khan@example.com', phone: '+92 321 7654321',
      city: 'Islamabad, Pakistan', link: 'github.com/ayeshak',
    },
    summary:
      'Software engineer who builds fast, reliable mobile and web apps. 4 years with React Native, Node.js and AWS, shipping apps used by more than 500,000 people.',
    experience: [
      job('Software Engineer II', 'PayLink', 'Islamabad', '2022', 'Present', [
        'Rebuilt the payments app in React Native, cutting crashes by 70%', 'Led a team of 3 to launch bill payments in 6 weeks', 'Set up CI/CD that halved release time',
      ]),
      job('Junior Developer', 'CodeNest', 'Rawalpindi', '2020', '2022', [
        'Built 12 client websites with React and Node.js', 'Raised test coverage from 30% to 80%',
      ]),
    ],
    education: [school('BS Software Engineering', 'NUST, Islamabad', '2016', '2020', 'CGPA 3.6 / 4.0')],
    skills: ['React Native', 'TypeScript', 'Node.js', 'AWS', 'PostgreSQL', 'Git and CI/CD'],
    projects: [project('ZipCart', 'Open-source shopping app in React Native. 1,200 stars on GitHub.')],
    languages: ['English', 'Urdu', 'Pashto'],
    certifications: ['AWS Certified Developer, 2023'],
  }),

  // Bilal Raza, Computer Science Student
  student: () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Bilal Raza', jobTitle: 'Computer Science Student', email: 'bilal.raza@example.com', phone: '+92 333 5551234',
      city: 'Faisalabad, Pakistan', link: 'linkedin.com/in/bilalraza',
    },
    summary:
      'Final-year computer science student looking for a software internship. Built 3 full-stack projects and won 2nd place at a national hackathon.',
    education: [
      school('BS Computer Science', 'GC University, Faisalabad', '2022', '2026', 'CGPA 3.7 / 4.0, Dean\'s honor list'),
      school('FSc Pre-Engineering', 'Punjab Group of Colleges', '2020', '2022', '89%'),
    ],
    projects: [
      project('Campus Lost and Found', 'React Native and Firebase app. 600 students used it in the first month.'),
      project('Library Manager', 'Java and MySQL desktop app for the department library.'),
    ],
    experience: [job('Web Development Intern', 'TechVerse', 'Faisalabad', '2025-06', '2025-08', ['Built 4 landing pages with React', 'Fixed 30+ bugs in the admin panel'])],
    skills: ['Java', 'Python', 'React', 'Firebase', 'SQL', 'Figma'],
    achievements: ['2nd place, National Hackathon 2025', 'Dean\'s honor list, 4 semesters', 'Google Developer Student Club lead'],
    languages: ['English', 'Urdu', 'Punjabi'],
  }),

  // Sara Malik, Brand and Graphic Designer
  designer: () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Sara Malik', jobTitle: 'Brand and Graphic Designer', email: 'sara.malik@example.com', phone: '+92 302 8889990',
      city: 'Karachi, Pakistan', link: 'behance.net/saramalik',
    },
    summary: 'Brand designer with 5 years of experience creating identities, packaging and social campaigns for more than 40 brands.',
    experience: [
      job('Senior Designer', 'Blue Kite Studio', 'Karachi', '2022', 'Present', [
        'Designed identities for 15 brands, including 2 national retail chains', 'Art-directed a campaign that reached 3 million people',
      ]),
      job('Graphic Designer', 'Pixel Lane', 'Karachi', '2020', '2022', ['Created packaging for 30+ food products', 'Ran social media design for 8 clients']),
    ],
    education: [school('BDes Communication Design', 'Indus Valley School of Art and Architecture', '2016', '2020', 'Distinction in final thesis')],
    skills: ['Brand identity', 'Packaging', 'Illustrator', 'Photoshop', 'Figma', 'After Effects'],
    languages: ['English', 'Urdu'],
    achievements: ['Shortlisted, Pakistan Design Awards 2024'],
  }),

  // Dr. Nadia Hussain, Postdoctoral Researcher
  academic: () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Dr. Nadia Hussain', jobTitle: 'Postdoctoral Researcher, Analytical Chemistry', email: 'nadia.hussain@example.edu', phone: '+92 300 4445556',
      city: 'Lahore, Pakistan', link: 'orcid.org/0000-0002-1234-5678',
    },
    summary: 'Chemist researching low-cost water testing methods. 9 peer-reviewed papers, 2 funded projects and 4 years of undergraduate teaching.',
    education: [
      school('PhD Analytical Chemistry', 'University of the Punjab, Lahore', '2018', '2023', 'Thesis: Paper-based sensors for arsenic in groundwater'),
      school('MPhil Chemistry', 'Quaid-i-Azam University, Islamabad', '2016', '2018', 'CGPA 3.8 / 4.0'),
    ],
    experience: [
      job('Postdoctoral Researcher', 'Centre for Water Research', 'Lahore', '2023', 'Present', [
        'Lead a 4-person team on field-ready arsenic test kits', 'Secured PKR 6M research grant',
      ]),
      job('Teaching Assistant', 'University of the Punjab', 'Lahore', '2019', '2023', ['Taught lab sessions for 120 students each year']),
    ],
    publications: [
      'Hussain N., Ahmed R. (2024). Low-cost paper sensors for arsenic detection. Journal of Water Chemistry, 12(3), 45–58.',
      'Hussain N., et al. (2023). Field testing of colorimetric kits in Punjab. Environmental Monitoring, 8(1), 101–112.',
    ],
    skills: ['HPLC', 'Spectroscopy', 'Sensor design', 'Python for data', 'Grant writing'],
    languages: ['English', 'Urdu'],
  }),

  // Muhammad Usman, Pakistan government CV
  government: () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Muhammad Usman', jobTitle: 'Curriculum Vitae', email: 'usman.akram@example.com', phone: '+92 345 1112223', city: '', link: '',
      fatherName: 'Muhammad Akram', cnic: '36302-0000000-0', dateOfBirth: '12 March 1996', domicile: 'Multan, Punjab',
      maritalStatus: 'Single', nationality: 'Pakistani', address: 'House 12, Street 4, Gulgasht Colony, Multan',
    },
    summary: 'To serve in a public sector organization where I can use my administration and management skills to improve service delivery.',
    education: [
      school('MBA (HRM)', 'Bahauddin Zakariya University', '', '2020', 'CGPA 3.5'),
      school('BBA', 'Bahauddin Zakariya University', '', '2018', 'CGPA 3.4'),
      school('FSc (Pre-Engineering)', 'BISE Multan', '', '2014', '920 / 1100'),
      school('Matric (Science)', 'BISE Multan', '', '2012', '960 / 1050'),
    ],
    experience: [
      job('Admin Officer', 'Pak Textile Mills', 'Multan', '2021', 'Present', [
        'Manage office records, procurement files and staff attendance for 250 employees', 'Prepare monthly administration reports for management',
      ]),
    ],
    skills: ['MS Office (Word, Excel, PowerPoint)', 'Office management', 'Record keeping', 'English and Urdu typing, 40 wpm'],
    languages: ['Urdu', 'English', 'Saraiki'],
  }),

  // ---- the 50-template pack (reference CONS ... TA) ----

  // Omar Siddiqui, Management Consultant
  'consultant': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Omar Siddiqui', jobTitle: 'Management Consultant', email: 'omar.siddiqui@example.com', phone: '+92 300 2223344',
      city: 'Karachi, Pakistan', link: 'linkedin.com/in/omarsiddiqui',
    },
    summary:
      'Consultant with 6 years of experience in strategy and operations for banks, telecoms and retail. Delivered cost savings of more than PKR 900M across 14 projects.',
    experience: [
      job('Senior Consultant', 'Meridian Advisory', 'Karachi', '2022', 'Present', ['Led an operating model redesign for a top-5 bank, saving PKR 380M a year', 'Managed teams of up to 6 consultants']),
      job('Business Analyst', 'Crest Partners', 'Lahore', '2019', '2022', ['Built market-entry models for 3 telecom clients', 'Ran 40+ executive interviews']),
    ],
    education: [
      school('MBA', 'IBA Karachi', '2017', '2019', 'Dean\'s list'),
      school('BSc Economics', 'LUMS', '2013', '2017', ''),
    ],
    skills: ['Strategy', 'Financial modeling', 'Process redesign', 'Stakeholder management', 'Excel and PowerPoint', 'SQL basics'],
    languages: ['English', 'Urdu'],
    certifications: ['Lean Six Sigma Green Belt, 2021'],
  }),

  // Fatima Noor, Operations Manager
  'manager': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Fatima Noor', jobTitle: 'Operations Manager', email: 'fatima.noor@example.com', phone: '+92 321 3334455',
      city: 'Lahore, Pakistan', link: 'linkedin.com/in/fatimanoor',
    },
    summary:
      'Operations manager who runs warehouses and delivery teams. 8 years in e-commerce logistics, leading up to 120 people and cutting late deliveries by half.',
    experience: [
      job('Operations Manager', 'QuickCart', 'Lahore', '2021', 'Present', ['Run 3 warehouses and 120 staff', 'Cut late deliveries from 14% to 6%', 'Launched same-day delivery in 2 cities']),
      job('Assistant Manager, Logistics', 'ShopNow', 'Lahore', '2017', '2021', ['Set up the returns process for 2,000 orders a day']),
    ],
    education: [
      school('MBA Supply Chain', 'University of Central Punjab', '2015', '2017', ''),
      school('BBA', 'University of the Punjab', '2011', '2015', ''),
    ],
    skills: ['Team leadership', 'Warehouse management', 'KPI dashboards', 'Vendor negotiation', 'SAP', 'Excel'],
    languages: ['English', 'Urdu', 'Punjabi'],
    certifications: ['PMP, 2022'],
  }),

  // Kamran Sheikh, Director of Sales
  'director': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Kamran Sheikh', jobTitle: 'Director of Sales', email: 'kamran.sheikh@example.com', phone: '+92 300 5556677',
      city: 'Islamabad, Pakistan', link: 'linkedin.com/in/kamransheikh',
    },
    summary:
      'Sales leader with 14 years in FMCG and telecom. Grew national revenue from PKR 2B to 5.5B and built teams of 200+ across 4 regions.',
    experience: [
      job('Director of Sales', 'Zenith Telecom', 'Islamabad', '2019', 'Present', ['Own PKR 5.5B annual revenue target', 'Lead 4 regional heads and 230 sales staff', 'Launched dealer app adopted by 9,000 retailers']),
      job('Regional Sales Manager', 'Golden Foods', 'Lahore', '2014', '2019', ['Grew North region sales by 2.4x', 'Opened 1,800 new outlets']),
      job('Area Sales Manager', 'Golden Foods', 'Faisalabad', '2010', '2014', ['Managed 22 distributors']),
    ],
    education: [
      school('MBA Marketing', 'IBA Karachi', '2008', '2010', ''),
      school('BCom', 'Hailey College of Commerce', '2004', '2008', ''),
    ],
    skills: ['Sales strategy', 'Key accounts', 'Distribution', 'Team building', 'Forecasting', 'CRM'],
    languages: ['English', 'Urdu'],
    achievements: ['CEO Award for Growth, 2022', 'Top region 3 years in a row'],
  }),

  // Zainab Qureshi, Advocate High Court
  'lawyer': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Zainab Qureshi', jobTitle: 'Advocate High Court', email: 'zainab.qureshi@example.com', phone: '+92 333 6667788',
      city: 'Lahore, Pakistan', link: 'linkedin.com/in/zainabqureshi',
    },
    summary:
      'Corporate and commercial lawyer with 7 years of practice. Advises companies on contracts, compliance and disputes before the Lahore High Court.',
    experience: [
      job('Associate', 'Khan and Partners, Advocates', 'Lahore', '2020', 'Present', ['Drafted and reviewed 300+ commercial contracts', 'Represented clients in 25 civil and banking cases']),
      job('Junior Associate', 'Rahman Law Chambers', 'Lahore', '2017', '2020', ['Prepared pleadings and legal research for senior counsel']),
    ],
    education: [
      school('LLM Corporate Law', 'University of London (external)', '2019', '2021', ''),
      school('LLB (Hons)', 'Punjab University Law College', '2012', '2017', ''),
    ],
    skills: ['Contract drafting', 'Corporate compliance', 'Civil litigation', 'Banking law', 'Legal research', 'Negotiation'],
    languages: ['English', 'Urdu'],
    certifications: ['Enrolled Advocate, Lahore High Court, 2019'],
  }),

  // Dr. Ali Raza, Medical Officer
  'doctor': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Dr. Ali Raza', jobTitle: 'Medical Officer', email: 'ali.raza@example.com', phone: '+92 300 7778899',
      city: 'Rawalpindi, Pakistan', link: 'PMDC 00000-P',
    },
    summary:
      'Medical officer with 4 years of experience in emergency and internal medicine. FCPS Part 1 passed, preparing for residency in medicine.',
    experience: [
      job('Medical Officer, Emergency', 'Holy Family Hospital', 'Rawalpindi', '2022', 'Present', ['Manage 60+ patients per shift in a busy emergency department', 'Train house officers in triage and resuscitation']),
      job('House Officer', 'Benazir Bhutto Hospital', 'Rawalpindi', '2020', '2021', ['Rotations in medicine, surgery, paediatrics and gynaecology']),
    ],
    education: [
      school('FCPS Part 1, Medicine', 'College of Physicians and Surgeons Pakistan', '', '2023', 'Passed'),
      school('MBBS', 'Rawalpindi Medical University', '2014', '2019', ''),
    ],
    skills: ['Emergency care', 'ACLS and BLS', 'Patient counselling', 'Clinical audit', 'Ultrasound basics'],
    languages: ['English', 'Urdu'],
    certifications: ['ACLS, 2024', 'BLS, 2024'],
  }),

  // Hassan Javed, Civil Engineer
  'engineer': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Hassan Javed', jobTitle: 'Civil Engineer', email: 'hassan.javed@example.com', phone: '+92 345 8889900',
      city: 'Peshawar, Pakistan', link: 'PEC CIVIL/00000',
    },
    summary:
      'Civil engineer with 5 years on roads, bridges and building projects. Supervised works worth PKR 3B and delivered 2 projects ahead of schedule.',
    experience: [
      job('Site Engineer', 'Frontier Builders', 'Peshawar', '2021', 'Present', ['Supervise a PKR 1.2B road and bridge package', 'Lead 4 supervisors and 150 workers', 'Zero lost-time accidents in 600,000 work hours']),
      job('Junior Engineer', 'Pak Infra Consultants', 'Islamabad', '2019', '2021', ['Prepared BOQs and quantity surveys for 6 buildings']),
    ],
    education: [
      school('BSc Civil Engineering', 'UET Peshawar', '2015', '2019', 'CGPA 3.4 / 4.0'),
    ],
    skills: ['AutoCAD', 'ETABS', 'Primavera P6', 'Quantity surveying', 'Site supervision', 'Quality control'],
    languages: ['English', 'Urdu', 'Pashto'],
    certifications: ['Registered Engineer, PEC'],
  }),

  // Amna Tariq, Secondary School Teacher
  'teacher': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Amna Tariq', jobTitle: 'Secondary School Teacher', email: 'amna.tariq@example.com', phone: '+92 302 9990011',
      city: 'Hyderabad, Pakistan', link: 'linkedin.com/in/amnatariq',
    },
    summary:
      'Science teacher with 6 years of classroom experience in grades 6 to 10. Raised class board results in chemistry from 71% to 88% average.',
    experience: [
      job('Science Teacher', 'The City School', 'Hyderabad', '2021', 'Present', ['Teach chemistry and biology to 160 students in grades 8 to 10', 'Started a science club with 45 members']),
      job('Teacher', 'Beaconlight Academy', 'Hyderabad', '2018', '2021', ['Taught general science to grades 6 and 7', 'Coordinated parent-teacher meetings']),
    ],
    education: [
      school('MSc Chemistry', 'University of Sindh', '2015', '2017', ''),
      school('B.Ed', 'Allama Iqbal Open University', '2018', '2019', ''),
    ],
    skills: ['Lesson planning', 'Classroom management', 'Lab safety', 'Google Classroom', 'Assessment design'],
    languages: ['English', 'Urdu', 'Sindhi'],
    achievements: ['Best Teacher Award, 2023'],
  }),

  // Mahnoor Aslam, Digital Marketing Specialist
  'marketing': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Mahnoor Aslam', jobTitle: 'Digital Marketing Specialist', email: 'mahnoor.aslam@example.com', phone: '+92 321 1212121',
      city: 'Karachi, Pakistan', link: 'mahnooraslam.com',
    },
    summary:
      'Digital marketer who turns ad budgets into sales. 5 years running Meta, Google and TikTok campaigns for fashion and food brands.',
    experience: [
      job('Digital Marketing Specialist', 'Trendz Apparel', 'Karachi', '2022', 'Present', ['Manage PKR 3M monthly ad spend with 4.2x return', 'Grew Instagram from 40K to 310K followers']),
      job('Social Media Executive', 'FoodHub', 'Karachi', '2020', '2022', ['Ran content calendar for 6 restaurant brands', 'Cut cost per order by 35%']),
    ],
    education: [
      school('BBA Marketing', 'SZABIST Karachi', '2016', '2020', ''),
    ],
    skills: ['Meta Ads', 'Google Ads', 'TikTok Ads', 'SEO', 'Content strategy', 'Analytics'],
    languages: ['English', 'Urdu'],
    certifications: ['Google Ads Search Certification', 'Meta Certified Media Buyer'],
    projects: [project('Eid 2024 campaign', '18M views and record sales week for Trendz')],
  }),

  // Ali Haider, Illustrator and Visual Artist
  'artist': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Ali Haider', jobTitle: 'Illustrator and Visual Artist', email: 'ali.haider@example.com', phone: '+92 333 3434343',
      city: 'Lahore, Pakistan', link: 'instagram.com/alihaider.art',
    },
    summary:
      'Illustrator creating book covers, editorial art and murals. Work published in 3 national magazines and shown in 4 group exhibitions.',
    experience: [
      job('Freelance Illustrator', 'Self-employed', 'Lahore', '2020', 'Present', ['Illustrated 22 book covers for 5 publishers', 'Painted 3 public murals for city projects']),
      job('Junior Illustrator', 'Inkwell Studio', 'Lahore', '2018', '2020', ['Drew characters for 2 children\'s book series']),
    ],
    education: [
      school('BFA Painting', 'National College of Arts, Lahore', '2014', '2018', 'Honors thesis'),
    ],
    skills: ['Illustration', 'Procreate', 'Photoshop', 'Watercolor', 'Murals', 'Character design'],
    languages: ['English', 'Urdu', 'Punjabi'],
    achievements: ['Group show, Alhamra Art Gallery, 2024'],
    projects: [project('Lahore Streets', 'Series of 30 city illustrations, exhibited 2024'), project('Moon Tales', 'Children\'s book, 12 full-page illustrations')],
  }),

  // Hira Shah, FSc Student
  'school-leaver': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Hira Shah', jobTitle: 'FSc Student', email: 'hira.shah@example.com', phone: '+92 300 4545454',
      city: 'Quetta, Pakistan', link: '',
    },
    summary:
      'Hardworking FSc Pre-Medical student with A+ grades, looking for a part-time tutoring role and preparing for MDCAT.',
    experience: [
      job('Home Tutor', 'Self-employed', 'Quetta', '2024', 'Present', ['Tutor 6 students in grades 6 to 8 in science and maths']),
    ],
    education: [
      school('FSc Pre-Medical (Part 1)', 'Government Girls College, Quetta', '2025', '2026', '486 / 550 in Part 1'),
      school('Matric (Science)', 'BISE Quetta', '', '2024', '1,032 / 1,100, A+ grade'),
    ],
    skills: ['Biology', 'Chemistry', 'MS Word and PowerPoint', 'Public speaking', 'Teamwork'],
    languages: ['English', 'Urdu', 'Balochi'],
    achievements: ['2nd position in district, Matric 2024', 'School debate team captain'],
  }),

  // Ahmed Nawaz, Scholarship Applicant, BS Electrical Engineering
  'scholarship': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Ahmed Nawaz', jobTitle: 'Scholarship Applicant, BS Electrical Engineering', email: 'ahmed.nawaz@example.com', phone: '+92 333 5656565',
      city: 'Sukkur, Pakistan', link: 'linkedin.com/in/ahmednawaz',
    },
    summary:
      'Electrical engineering student from a low-income family, top 3% of class, applying for need-and-merit scholarships to continue studies.',
    experience: [
      job('Volunteer Tutor', 'Taleem Foundation', 'Sukkur', '2023', 'Present', ['Teach maths to 30 children every weekend']),
    ],
    education: [
      school('BS Electrical Engineering (Year 2)', 'NED University, Karachi', '2024', '2028', 'CGPA 3.85 / 4.0, top 3% of class'),
      school('FSc Pre-Engineering', 'BISE Sukkur', '', '2024', '1,012 / 1,100'),
    ],
    skills: ['Circuit design', 'MATLAB', 'Arduino', 'Python', 'Leadership'],
    languages: ['English', 'Urdu', 'Sindhi'],
    achievements: ['PEEF scholarship holder, 2024', '1st place, NED Robotics Challenge 2025', 'Gold medal, intermediate board, Sukkur'],
  }),

  // Iqra Saleem, BBA Graduate, Marketing
  'first-job': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Iqra Saleem', jobTitle: 'BBA Graduate, Marketing', email: 'iqra.saleem@example.com', phone: '+92 302 6767676',
      city: 'Multan, Pakistan', link: 'linkedin.com/in/iqrasaleem',
    },
    summary:
      'Fresh BBA graduate looking for a first job in marketing or sales. Completed 2 internships and led a university event with 1,500 attendees.',
    experience: [
      job('Marketing Intern', 'Nishat Linen', 'Multan', '2024-06', '2024-08', ['Helped run 2 in-store campaigns', 'Collected and analysed 400 customer surveys']),
      job('Sales Intern', 'Jazz', 'Multan', '2024-01', '2024-03', ['Visited 120 retailers and reported weekly sales']),
    ],
    education: [
      school('BBA (Hons) Marketing', 'Bahauddin Zakariya University', '2021', '2025', 'CGPA 3.5 / 4.0'),
    ],
    skills: ['Market research', 'Canva', 'MS Excel', 'Social media', 'Communication', 'Event planning'],
    languages: ['English', 'Urdu', 'Saraiki'],
    achievements: ['Led the BZU Business Fest 2024, 1,500 attendees'],
  }),

  // Usman Tariq, Data Analyst, MS Data Science
  'graduate': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Usman Tariq', jobTitle: 'Data Analyst, MS Data Science', email: 'usman.tariq@example.com', phone: '+92 321 7878787',
      city: 'Islamabad, Pakistan', link: 'github.com/usmantariq',
    },
    summary:
      'Recent MS Data Science graduate who turns messy data into clear decisions. Built 5 end-to-end projects in Python, SQL and Power BI.',
    experience: [
      job('Data Science Intern', 'Systems Ltd', 'Islamabad', '2024-06', '2024-09', ['Cleaned and analysed 2M rows of retail data', 'Built churn model that flagged 18% of at-risk customers']),
    ],
    education: [
      school('MS Data Science', 'FAST NUCES, Islamabad', '2023', '2025', 'CGPA 3.7 / 4.0'),
      school('BS Mathematics', 'Quaid-i-Azam University', '2019', '2023', ''),
    ],
    skills: ['Python', 'SQL', 'Power BI', 'Pandas', 'Scikit-learn', 'Statistics'],
    languages: ['English', 'Urdu'],
    projects: [project('Price predictor', 'Model for Lahore property prices, 0.89 R² on test data'), project('Sales dashboard', 'Power BI dashboard for a 40-store chain (thesis partner)')],
  }),

  // Maryam Ali, Research Assistant, Molecular Biology
  'research-assistant': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Maryam Ali', jobTitle: 'Research Assistant, Molecular Biology', email: 'maryam.ali@example.edu', phone: '+92 300 9898989',
      city: 'Islamabad, Pakistan', link: 'orcid.org/0000-0003-0000-0000',
    },
    summary:
      'Research assistant with 2 years of lab experience in molecular biology and genetics. Co-author on 2 papers, applying for PhD programs.',
    experience: [
      job('Research Assistant', 'National Institute for Genomics', 'Islamabad', '2024', 'Present', ['Run PCR and sequencing for a wheat disease project', 'Manage lab inventory and safety records']),
    ],
    education: [
      school('MPhil Biotechnology', 'Quaid-i-Azam University', '2022', '2024', 'CGPA 3.8 / 4.0'),
      school('BS Biotechnology', 'COMSATS University', '2018', '2022', ''),
    ],
    skills: ['PCR', 'DNA sequencing', 'Cell culture', 'R for statistics', 'Scientific writing'],
    languages: ['English', 'Urdu'],
    publications: ['Ali M., Khan S. (2025). Rust resistance genes in Pakistani wheat. Plant Genetics Letters, 7(2), 33–41.'],
  }),

  // Saad Ahmed, Student and Community Volunteer
  'volunteer': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Saad Ahmed', jobTitle: 'Student and Community Volunteer', email: 'saad.ahmed@example.com', phone: '+92 345 1010101',
      city: 'Karachi, Pakistan', link: 'linkedin.com/in/saadahmed',
    },
    summary:
      'Social sciences student who has volunteered 600+ hours in flood relief, education and blood drives. Looking for an NGO or development sector role.',
    experience: [
      job('Field Intern', 'Akhuwat', 'Karachi', 'Summer 2024', '', ['Interviewed 80 loan applicants', 'Prepared field reports']),
    ],
    education: [
      school('BS Social Sciences', 'University of Karachi', '2022', '2026', 'CGPA 3.3 / 4.0'),
    ],
    skills: ['Event coordination', 'Fundraising', 'Survey work', 'MS Office', 'Public speaking'],
    languages: ['English', 'Urdu', 'Sindhi'],
    volunteering: ['Flood relief coordinator, Alkhidmat, 2022: organized 40 volunteers and 1,200 ration packs', 'Teacher, The Citizens Foundation weekend school, 2023 – Present', 'Blood drive lead, Karachi University, 3 drives, 900 donors'],
  }),

  // Rabia Khan, Teaching Assistant, Computer Science
  'teaching-assistant': () => ({
    ...emptyContent(),
    personal: {
      fullName: 'Rabia Khan', jobTitle: 'Teaching Assistant, Computer Science', email: 'rabia.khan@example.edu', phone: '+92 321 2020202',
      city: 'Lahore, Pakistan', link: 'linkedin.com/in/rabiakhan',
    },
    summary:
      'MS Computer Science student and teaching assistant for programming courses. Helped 300+ students through labs, office hours and grading.',
    experience: [
      job('Teaching Assistant, Programming Fundamentals', 'UET Lahore', 'Lahore', '2024', 'Present', ['Run 2 weekly lab sessions of 50 students', 'Graded 600 assignments with written feedback']),
      job('Peer Tutor', 'UET Lahore', 'Lahore', '2022', '2024', ['Tutored juniors in C++ and data structures']),
    ],
    education: [
      school('MS Computer Science', 'UET Lahore', '2024', '2026', 'CGPA 3.6 / 4.0'),
      school('BS Computer Science', 'UET Lahore', '2020', '2024', ''),
    ],
    skills: ['C++', 'Python', 'Data structures', 'Teaching', 'Moodle', 'Git'],
    languages: ['English', 'Urdu'],
    achievements: ['Best TA award, Fall 2024'],
  }),
};

export const PERSONA_IDS = Object.keys(PERSONAS) as PersonaId[];

/** A fresh copy of a persona's content (gallery previews, "Fill with example"). */
export const samplePersona = (id: PersonaId): ResumeContent => PERSONAS[id]();

/**
 * "Fill with example" for a custom section (the personas have none): the most common extra section on Pakistani CVs.
 * The title is only used when the person hasn't named the section yet.
 */
export const sampleCustomSection = (): { title: string; bullets: string[] } => ({
  title: 'Volunteering',
  bullets: [
    'Taught English to 25 children every weekend at a community school, 2022 – Present',
    'Organised a blood donation drive that collected 140 bags in one day',
  ],
});
