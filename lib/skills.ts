/**
 * 200+ tech skills for resume/job keyword matching (free, no API).
 * Sorted longest-first for greedy matching in extractSkillsFromText.
 */
export const TECH_SKILLS = [
  "Amazon Web Services", "Google Cloud Platform", "Microsoft Azure",
  "Machine Learning", "Deep Learning", "Natural Language Processing",
  "Computer Vision", "Data Engineering", "Software Engineering",
  "Full-Stack Development", "Front-End Development", "Back-End Development",
  "Mobile Development", "DevOps", "Site Reliability Engineering",
  "Information Security", "Cybersecurity", "Cloud Computing",
  "Distributed Systems", "Microservices", "REST API", "GraphQL",
  "CI/CD", "Test-Driven Development", "Agile", "Scrum", "Kanban",
  "TypeScript", "JavaScript", "Python", "Java", "C++", "C#", "C",
  "Go", "Golang", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Scala",
  "R", "MATLAB", "Perl", "Haskell", "Elixir", "Clojure", "Dart",
  "Objective-C", "Assembly", "Fortran", "COBOL", "Lua", "Julia",
  "React", "React Native", "Next.js", "Vue.js", "Vue", "Angular",
  "Svelte", "Nuxt.js", "Gatsby", "Remix", "SolidJS", "jQuery",
  "Node.js", "Express.js", "Express", "NestJS", "FastAPI", "Django",
  "Flask", "Spring Boot", "Spring", "Ruby on Rails", "Rails", "Laravel",
  "ASP.NET", ".NET", "Symfony", "Phoenix", "Gin", "Fiber",
  "PostgreSQL", "MySQL", "MariaDB", "SQLite", "MongoDB", "Redis",
  "Cassandra", "DynamoDB", "Elasticsearch", "Neo4j", "CouchDB",
  "Firebase", "Supabase", "PlanetScale", "CockroachDB", "InfluxDB",
  "Snowflake", "BigQuery", "Redshift", "Databricks", "Apache Spark",
  "Hadoop", "Kafka", "RabbitMQ", "Apache Airflow", "dbt",
  "Docker", "Kubernetes", "Terraform", "Ansible", "Puppet", "Chef",
  "Helm", "ArgoCD", "Jenkins", "GitHub Actions", "GitLab CI",
  "CircleCI", "Travis CI", "Vagrant", "Pulumi", "CloudFormation",
  "AWS", "GCP", "Azure", "Heroku", "Vercel", "Netlify", "DigitalOcean",
  "Linux", "Unix", "Windows Server", "Bash", "Shell Scripting", "PowerShell",
  "Nginx", "Apache", "Load Balancing", "CDN", "DNS", "TCP/IP", "HTTP",
  "TensorFlow", "PyTorch", "Keras", "scikit-learn", "Pandas", "NumPy",
  "SciPy", "Jupyter", "OpenCV", "Hugging Face", "LangChain", "LLMs",
  "GPT", "BERT", "XGBoost", "LightGBM", "MLflow", "CUDA", "OpenCL",
  "HTML", "HTML5", "CSS", "CSS3", "Sass", "SCSS", "Less", "Tailwind CSS",
  "Bootstrap", "Material UI", "Chakra UI", "Styled Components", "Webpack",
  "Vite", "Babel", "ESLint", "Prettier", "Rollup", "Parcel",
  "Git", "GitHub", "GitLab", "Bitbucket", "SVN", "Mercurial",
  "Jira", "Confluence", "Figma", "Sketch", "Adobe XD", "InVision",
  "Postman", "Swagger", "OpenAPI", "gRPC", "WebSockets", "Socket.io",
  "OAuth", "JWT", "SAML", "LDAP", "SSL/TLS", "Encryption",
  "Selenium", "Cypress", "Playwright", "Jest", "Mocha", "Chai",
  "Pytest", "JUnit", "TestNG", "Cucumber", "RSpec", "Unit Testing",
  "Integration Testing", "E2E Testing", "TDD", "BDD",
  "Unity", "Unreal Engine", "Game Development", "OpenGL", "WebGL",
  "Blockchain", "Solidity", "Ethereum", "Smart Contracts", "Web3",
  "IoT", "Embedded Systems", "Arduino", "Raspberry Pi", "FPGA",
  "Tableau", "Power BI", "Looker", "Metabase", "Grafana", "Prometheus",
  "Splunk", "Datadog", "New Relic", "ELK Stack", "Logstash", "Kibana",
  "SAP", "Salesforce", "ServiceNow", "Workday", "Oracle", "SAP HANA",
  "WordPress", "Shopify", "Magento", "WooCommerce", "Contentful",
  "Stripe", "PayPal", "Square", "Plaid", "Twilio", "SendGrid",
  "Apache", "Nginx", "Tomcat", "IIS", "Memcached", "Varnish",
  "MapReduce", "Hive", "Pig", "Presto", "Flink", "Storm", "Beam",
  "Snowpack", "esbuild", "Turbopack", "pnpm", "Yarn", "npm",
  "Redux", "MobX", "Zustand", "Recoil", "RxJS", "NgRx",
  "Prisma", "Sequelize", "TypeORM", "Mongoose", "SQLAlchemy", "Hibernate",
  "ActiveRecord", "Drizzle", "Knex.js",
  "Storybook", "Chromatic", "Lighthouse", "Web Vitals", "SEO",
  "Accessibility", "WCAG", "Responsive Design", "PWA",
  "Microfrontends", "Monorepo", "Lerna", "Nx", "Turborepo",
  "Event-Driven Architecture", "CQRS", "Domain-Driven Design",
  "Design Patterns", "Data Structures", "Algorithms", "System Design",
  "Technical Writing", "API Design", "Database Design", "UML",
  "Wireframing", "Prototyping", "User Research", "A/B Testing",
  "ETL", "Data Pipeline", "Data Warehouse", "Data Lake", "Data Modeling",
  "Business Intelligence", "Analytics", "Statistics", "Probability",
  "Linear Algebra", "Calculus", "Optimization",
  "ARM", "x86", "RISC-V", "Verilog", "VHDL",
  "Qt", "GTK", "Electron", "Tauri", "WPF", "WinForms",
  "SOAP", "XML", "JSON", "YAML", "Protocol Buffers", "Avro",
  "Apache Kafka", "ActiveMQ", "ZeroMQ", "NATS",
  "Penetration Testing", "OWASP", "SOC 2", "HIPAA", "GDPR", "PCI DSS",
  "Incident Response", "Threat Modeling", "SIEM",
  "MLOps", "AIOps", "FinOps", "GitOps",
  "Serverless", "Lambda", "Cloud Functions", "Edge Computing",
  "WebAssembly", "WASM", "Rust WASM",
  "NoSQL", "SQL", "OLAP", "OLTP", "ACID", "CAP Theorem",
  "Sharding", "Replication", "Indexing", "Query Optimization",
  "Reverse Engineering", "Debugging", "Profiling", "Benchmarking",
  "Technical Leadership", "Mentoring", "Code Review", "Pair Programming",
];

/** Longest match first to avoid partial hits (e.g. "React" before "R") */
const SORTED_SKILLS = [...TECH_SKILLS].sort((a, b) => b.length - a.length);

export function extractSkillsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const skill of SORTED_SKILLS) {
    const pattern = skill
      .toLowerCase()
      .replace(/[.+#]/g, (c) => `\\${c}`)
      .replace(/\s+/g, "\\s+");
    const regex = new RegExp(`(?:^|[^a-z0-9])${pattern}(?:[^a-z0-9]|$)`, "i");
    if (regex.test(lower) || lower.includes(skill.toLowerCase())) {
      found.add(skill);
    }
  }

  return Array.from(found).slice(0, 30);
}

export function skillsOverlap(
  userSkills: string[],
  jobSkills: string[]
): { matching: string[]; missing: string[] } {
  const matching: string[] = [];
  const missing: string[] = [];

  for (const jobSkill of jobSkills) {
    const jLower = jobSkill.toLowerCase();
    const matched = userSkills.find(
      (u) =>
        u.toLowerCase().includes(jLower) || jLower.includes(u.toLowerCase())
    );
    if (matched) matching.push(matched);
    else missing.push(jobSkill);
  }

  return { matching, missing };
}
