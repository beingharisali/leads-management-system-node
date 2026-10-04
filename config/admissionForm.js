// Content of the public admission form (app/admission/[code] in the frontend),
// taken from IDEOVERSITY_Admission_Preview_v1.1.html. The text a student
// agrees to is versioned: bump TERMS.version whenever any of it changes, so
// every saved admission can be traced to the exact wording that was accepted.

// Courses offered on the form. Outlines summarise the published curriculum
// on ideocollege.com.
const COURSE_CATALOG = [
	{
		"id": "graphic-designing-course",
		"name": "Graphic Designing Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/graphic-designing-course/",
		"outline": [
			"Photoshop image editing and corrections",
			"Illustrator vector artwork",
			"Typography, logos and branding",
			"Portfolio work and freelancing"
		]
	},
	{
		"id": "ui-ux-design-course",
		"name": "UI/UX Designing Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/ui-ux-design-course/",
		"outline": [
			"Photoshop workspace and layers",
			"UI mockups and colour handling",
			"Preparing and exporting designs",
			"Freelance profiles and client acquisition"
		]
	},
	{
		"id": "video-editing-course",
		"name": "Video Editing Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/video-editing-course/",
		"outline": [
			"Audio recording and editing in Sound Forge",
			"Premiere Pro timeline and clip editing",
			"Transitions, titles and compositing",
			"After Effects layers, keyframes and text animation"
		]
	},
	{
		"id": "2d-3d-animation-course",
		"name": "2D 3D Animation Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/2d-3d-animation-course/",
		"outline": [
			"Animation principles and theory",
			"Illustrator and Premiere Pro",
			"After Effects motion work",
			"3D work in Autodesk 3ds Max and Maya"
		]
	},
	{
		"id": "interior-design-course",
		"name": "Interior Designing Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/interior-design-course/",
		"outline": [
			"Interior styles and space planning",
			"Colours, lighting and surface finishes",
			"3D modelling and rendering",
			"Furniture, fabrics and client projects"
		]
	},
	{
		"id": "exterior-designing-course",
		"name": "Exterior Designing Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/exterior-designing-course/",
		"outline": [
			"Exterior design foundations",
			"Materials and construction",
			"Landscape design and lighting",
			"Project planning and digital design tools"
		]
	},
	{
		"id": "digital-textile-designing-course",
		"name": "Digital Textile Design Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/digital-textile-designing-course/",
		"outline": [
			"Textile design tools and inspiration",
			"Pattern development and repeat designs",
			"Fabric formation and textile applications",
			"Design software and freelancing"
		]
	},
	{
		"id": "professional-photography-course",
		"name": "Professional Photography Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/professional-photography-course/",
		"outline": [
			"Camera equipment and photography foundations",
			"Practical image capture",
			"Photo editing and design",
			"Client management and photography business"
		]
	},
	{
		"id": "youtube-course",
		"name": "YouTube Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/youtube-course/",
		"outline": [
			"Channel strategy and audience planning",
			"Video production and editing",
			"Search visibility and thumbnails",
			"Community building, monetisation and analytics"
		]
	},
	{
		"id": "concept-art-digital-planting-course",
		"name": "Concept Art & Digital Planting Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/concept-art-digital-planting-course/",
		"outline": [
			"Digital drawing tools and sketching",
			"Perspective, colour and lighting",
			"Character and environment artwork",
			"Painting styles and portfolio development"
		]
	},
	{
		"id": "art-design-course",
		"name": "Art & Design Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/art-design-course/",
		"outline": [
			"Art history and drawing foundations",
			"Composition, colour and typography",
			"Digital design, 3D and animation basics",
			"Portfolio projects and client communication"
		]
	},
	{
		"id": "python-course",
		"name": "Python Course",
		"category": "Development",
		"url": "https://ideocollege.com/python-course/",
		"outline": [
			"Python syntax, control flow and collections",
			"Functions, modules and object orientation",
			"Web foundations and frontend tools",
			"Databases, backend and application projects"
		]
	},
	{
		"id": "full-stack-ai-ml-course",
		"name": "Full Stack AI/ML Course",
		"category": "Development",
		"url": "https://ideocollege.com/full-stack-ai-ml-course/",
		"outline": [
			"AI and machine learning foundations",
			"Programming and frontend development",
			"Backend services and databases",
			"AI applications and a capstone project"
		]
	},
	{
		"id": "blockchain-development-course",
		"name": "Blockchain Development Course",
		"category": "Development",
		"url": "https://ideocollege.com/blockchain-development-course/",
		"outline": [
			"Blockchain foundations and design",
			"Core concepts and chain structure",
			"Blockchain learning units",
			"Practical blockchain development skills"
		]
	},
	{
		"id": "mean-stack-and-mern-stack-course",
		"name": "MEAN Stack and MERN Stack Course",
		"category": "Development",
		"url": "https://ideocollege.com/mean-stack-and-mern-stack-course/",
		"outline": [
			"JavaScript and Node.js",
			"MongoDB data modelling and CRUD",
			"Express backend services",
			"Angular or React interfaces and full stack projects"
		]
	},
	{
		"id": "react-development-course",
		"name": "React Development (IOS, Android & Web) Course",
		"category": "Development",
		"url": "https://ideocollege.com/react-development-course/",
		"outline": [
			"React foundations and component development",
			"React for iOS and Android",
			"React web applications",
			"Advanced concepts, best practices and project workshops"
		]
	},
	{
		"id": "php-code-ignition-course",
		"name": "PHP Code Ignition Course",
		"category": "Development",
		"url": "https://ideocollege.com/php-code-ignition-course/",
		"outline": [
			"PHP and CodeIgniter foundations",
			"MVC, routing and database operations",
			"Forms, authentication and APIs",
			"Security, testing and application projects"
		]
	},
	{
		"id": "android-development-with-flutter-course",
		"name": "Android Development with Flutter Course",
		"category": "Development",
		"url": "https://ideocollege.com/android-development-with-flutter-course/",
		"outline": [
			"Dart and Flutter setup",
			"Widgets, navigation and state handling",
			"APIs, Firebase and interaction design",
			"Testing and app deployment"
		]
	},
	{
		"id": "android-development-with-java-course",
		"name": "Android Development with Java Course",
		"category": "Development",
		"url": "https://ideocollege.com/android-development-with-java-course/",
		"outline": [
			"Java and Android Studio foundations",
			"Android interfaces and application components",
			"Local databases and API integration",
			"App testing, debugging and Play Store deployment"
		]
	},
	{
		"id": "web-development-course",
		"name": "Web Development Course",
		"category": "Development",
		"url": "https://ideocollege.com/web-development-course/",
		"outline": [
			"HTML, CSS and responsive layouts",
			"JavaScript and frontend development",
			"Backend and database development",
			"Full stack applications and MEAN stack topics"
		]
	},
	{
		"id": "game-development-course",
		"name": "Game Development Course",
		"category": "Development",
		"url": "https://ideocollege.com/game-development-course/",
		"outline": [
			"Unity workspace and game assets",
			"Scripting and object behaviours",
			"2D/3D physics, animation and interactions",
			"Game optimisation and mobile builds"
		]
	},
	{
		"id": "ai-course",
		"name": "AI (Artificial Intelligence) Course",
		"category": "Development",
		"url": "https://ideocollege.com/ai-course/",
		"outline": [
			"AI foundations and data preparation",
			"Supervised, unsupervised and reinforcement learning",
			"Neural networks and deep learning",
			"Responsible AI and practical applications"
		]
	},
	{
		"id": "wordpress-full-customization-course",
		"name": "WordPress Full Customization Course",
		"category": "Development",
		"url": "https://ideocollege.com/wordpress-full-customization-course/",
		"outline": [
			"WordPress installation and configuration",
			"Themes and customisation",
			"Plugins and site functionality",
			"Practical website development"
		]
	},
	{
		"id": "digital-marketing-course",
		"name": "Digital Marketing Course",
		"category": "Marketing",
		"url": "https://ideocollege.com/digital-marketing-course/",
		"outline": [
			"Digital marketing foundations and planning",
			"Social media and audience targeting",
			"Search marketing and online promotion",
			"Campaign measurement and practical work"
		]
	},
	{
		"id": "seo-course",
		"name": "SEO Course",
		"category": "Marketing",
		"url": "https://ideocollege.com/seo-course/",
		"outline": [
			"Search engine foundations and keywords",
			"On-page and off-page optimisation",
			"Website visibility and search performance",
			"SEO tools and practical optimisation"
		]
	},
	{
		"id": "social-media-marketing-course",
		"name": "Social Media Marketing Course",
		"category": "Marketing",
		"url": "https://ideocollege.com/social-media-marketing-course/",
		"outline": [
			"Brand strategy and audience research",
			"Social platform content and communities",
			"Advertising account and campaign management",
			"Reporting and performance evaluation"
		]
	},
	{
		"id": "content-writing-course",
		"name": "Content Writing Course",
		"category": "Marketing",
		"url": "https://ideocollege.com/content-writing-course/",
		"outline": [
			"Writing principles and audience awareness",
			"Website, article and blog content",
			"Keywords, metadata and SEO writing",
			"Content structure and practical writing work"
		]
	},
	{
		"id": "tiktok-influencer-marketing-course",
		"name": "TikTok Influencer Marketing Course",
		"category": "Marketing",
		"url": "https://ideocollege.com/tiktok-influencer-marketing-course/",
		"outline": [
			"TikTok platform and audience foundations",
			"Content and influencer strategy",
			"Brand promotion and collaboration",
			"Campaign evaluation"
		]
	},
	{
		"id": "daraz-course",
		"name": "Daraz Course",
		"category": "E-commerce",
		"url": "https://ideocollege.com/daraz-course/",
		"outline": [
			"Daraz marketplace and seller setup",
			"Product listings and store management",
			"Digital promotion and search visibility",
			"Customer enquiries and service practices"
		]
	},
	{
		"id": "ebay-course",
		"name": "eBay Course",
		"category": "E-commerce",
		"url": "https://ideocollege.com/ebay-course/",
		"outline": [
			"eBay account and marketplace navigation",
			"Product listings, images and descriptions",
			"Fixed pricing and auctions",
			"Practical online selling workflows"
		]
	},
	{
		"id": "shopify-course",
		"name": "Shopify Course",
		"category": "E-commerce",
		"url": "https://ideocollege.com/shopify-course/",
		"outline": [
			"Shopify store setup and themes",
			"Products, descriptions and inventory",
			"Domains, payments and shipping",
			"Orders, customer support and store marketing"
		]
	},
	{
		"id": "ielts-preparation",
		"name": "IELTS Preparation Reading/Writing",
		"category": "Languages",
		"url": "https://ideocollege.com/ielts-preparation/",
		"outline": [
			"IELTS reading strategies and vocabulary",
			"Writing Task 1 data descriptions",
			"Writing Task 2 essays and grammar",
			"Timed practice, mock tests and feedback"
		]
	},
	{
		"id": "chinese-language-japanese-language",
		"name": "Chinese Language/Japanese language",
		"category": "Languages",
		"url": "https://ideocollege.com/chinese-language-japanese-language/",
		"outline": [
			"Vocabulary, grammar and sentence building",
			"Speaking, listening, reading and writing",
			"Cultural awareness and conversation",
			"Practical travel and business communication"
		]
	},
	{
		"id": "spoken-english-course",
		"name": "Spoken English Course",
		"category": "Languages",
		"url": "https://ideocollege.com/spoken-english-course/",
		"outline": [
			"Vocabulary, grammar and sentence formation",
			"Pronunciation and speaking fluency",
			"Discussion, presentations and phone communication",
			"Interview, confidence and negotiation practice"
		]
	},
	{
		"id": "professional-diploma-in-graphic-designing",
		"name": "Professional Diploma in Graphic Designing",
		"category": "Diplomas",
		"url": "https://ideocollege.com/professional-diploma-in-graphic-designing/",
		"outline": [
			"Illustrator vector artwork and layouts",
			"Photoshop corrections, layers and masks",
			"Digital painting, sketching and photography",
			"Portfolio and freelancing practice"
		]
	},
	{
		"id": "diploma-in-computer-science-and-information-technology",
		"name": "Diploma in Computer Science and Information Technology",
		"category": "Diplomas",
		"url": "https://ideocollege.com/diploma-in-computer-science-and-information-technology/",
		"outline": [
			"Computer foundations and Microsoft Office",
			"Communication and entrepreneurship",
			"Graphics and website development",
			"Digital marketing and freelancing"
		]
	},
	{
		"id": "freelancing-course",
		"name": "Freelancing Course",
		"category": "Professional skills",
		"url": "https://ideocollege.com/freelancing-course/",
		"outline": [
			"Freelance niches and skill development",
			"Profiles, portfolios and client communication",
			"Pricing, negotiation and productivity",
			"Marketing and finance basics"
		]
	},
	{
		"id": "ms-office-course",
		"name": "MS Office Course",
		"category": "Professional skills",
		"url": "https://ideocollege.com/ms-office-course/",
		"outline": [
			"Word documents, formatting and tables",
			"Excel workbooks, formulas and charts",
			"Advanced data handling and macros",
			"PowerPoint slides and presentations"
		]
	},
	{
		"id": "amazon-course",
		"name": "Amazon Course",
		"category": "E-commerce",
		"url": "https://ideocollege.com/amazon-course/",
		"outline": [
			"Amazon business models and Seller Central",
			"Product research and supplier sourcing",
			"Listings, logistics and customer support",
			"Advertising, launches and financial records"
		]
	},
	{
		"id": "advanced-illustrator-course",
		"name": "Advanced Illustrator Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/advanced-illustrator-course/",
		"outline": [
			"Illustrator workspace and vector drawing",
			"Pen tools, shapes and path operations",
			"Artboards and advanced artwork techniques",
			"Practical illustration workflows"
		]
	},
	{
		"id": "advanced-photoshop-course",
		"name": "Advanced Photoshop Course",
		"category": "Design and media",
		"url": "https://ideocollege.com/advanced-photoshop-course/",
		"outline": [
			"Photoshop tools and image correction",
			"Retouching, layers and blending",
			"Typography and digital illustration",
			"Output preparation and workflow automation"
		]
	},
	{
		"id": "laravel-development-with-angular-course",
		"name": "Laravel Development with Angular Course",
		"category": "Development",
		"url": "https://ideocollege.com/laravel-development-with-angular-course/",
		"outline": [
			"Laravel setup, MVC and routing",
			"Eloquent databases and authentication",
			"APIs, caching and application debugging",
			"Angular integration and practical projects"
		]
	},
	{
		"id": "angular-7-development-course",
		"name": "Angular 7 Development Course",
		"category": "Development",
		"url": "https://ideocollege.com/angular-7-development-course/",
		"outline": [
			"TypeScript and Angular setup",
			"Components, directives and data binding",
			"Forms, validation and routing",
			"Services, dependency injection and application projects"
		]
	},
	{
		"id": "android-development-with-kotlin-course",
		"name": "Android Development with Kotlin Course",
		"category": "Development",
		"url": "https://ideocollege.com/android-development-with-kotlin-course/",
		"outline": [
			"Kotlin and Android Studio foundations",
			"Layouts, activities and fragments",
			"Local storage, APIs and coroutines",
			"Material Design, testing and publishing"
		]
	},
	{
		"id": "ethical-hacking-course",
		"name": "Ethical Hacking Course",
		"category": "Professional skills",
		"url": "https://ideocollege.com/ethical-hacking-course/",
		"outline": [
			"Authorised security testing and lab setup",
			"Reconnaissance and scanning concepts",
			"Web, network and wireless security testing",
			"Post-test analysis and social engineering awareness"
		]
	}
];

const OUTLINE_CHECKED_ON = "2026-10-01";

const TERMS = {
	version: "2026-10-04-v4",
	checkboxText: "I have read, understood and agree to IDEOVERSITY’s Admission Terms and the identity record notice.",
	terms: [
		"I have reviewed the selected course outline, delivery mode, duration, schedule, facilities available to me and the disclosed total fees before admission. I may ask questions or request a clarification before agreeing.",
		"My enrolment, student account and access are personal. I will not transfer them to another person or allow someone to impersonate me. A course transfer or freeze requires written approval under the disclosed policy.",
		"I will pay only the charges and instalments disclosed in my admission record, by their stated due dates. IDEOVERSITY will provide payment acknowledgements. No undisclosed charge or retrospective fee increase applies to this admission; any optional additional service requires my agreement.",
		"If I voluntarily withdraw after classes begin while the agreed training is being delivered, the disclosed non-refundable fee policy applies, subject to applicable law. Before-start refund terms appear below. This does not exclude refunds or remedies for non-delivery, faulty services, misleading claims or other legal entitlements.",
		"Late payment may lead to restricted access or suspension after notice and an opportunity to resolve the unpaid amount. Any termination and fee adjustment must follow the disclosed policy and applicable law.",
		"I will treat instructors, staff and students respectfully. Harassment, discrimination, threats, violence, bullying, abuse and disruptive behaviour are prohibited. Complaints may be reported to administration without retaliation.",
		"I will follow the published dress code, classroom discipline, attendance procedure and reasonable safety instructions. Rules must be communicated and applied consistently.",
		"Possessing, using or distributing unlawful drugs or intoxicating substances on campus is prohibited. Attendance while intoxicated is not allowed.",
		"Smoking and vaping are prohibited within institute premises.",
		"Weapons and dangerous objects are prohibited on campus, except any legally authorised security arrangements. I will follow emergency, evacuation and fire-safety instructions and report hazards promptly.",
		"I will use computers, labs, equipment, networks and facilities only as authorised. Damage, theft, piracy, unauthorised access, cheating and misuse of another person’s account are prohibited. Security-testing coursework must be performed only on systems where explicit permission has been given.",
		"I will keep my belongings secure and use available storage responsibly. The institute does not insure my belongings; this does not remove responsibility imposed by law for its own negligence or misconduct.",
		"I will obtain permission before recording or photographing instructors, staff or students and before sharing their images. Admission consent is not permission to use my image in advertising; promotional use requires a separate optional consent.",
		"Children, guests and unregistered persons may enter or attend only with prior permission and any required safety arrangements.",
		"A serious safety risk may require immediate temporary removal or suspension. Other disciplinary action will normally include notice of the concern and an opportunity to respond. Written reasons and an administration review route will be provided. Discipline does not automatically forfeit every refund or legal remedy.",
		"Classes may be reasonably rescheduled for holidays, maintenance or unavoidable disruption, with notice where possible and suitable make-up arrangements. A material change or cancellation must be communicated with available alternatives and any applicable refund rights.",
		"Certificate eligibility requires 80% attendance and completion of required assignments, projects and assessments, unless the displayed course or awarding-body requirements differ. Assessment rules, certificate issuer, any disclosed certificate fee and expected issuance process must be explained before enrolment.",
		"Any internship, employment, earnings, external certification, accreditation or government-affiliation claim must match the written offer and verifiable authorisation. No job, income or placement is guaranteed unless expressly promised in the admission record.",
		"I will provide accurate identity information. A student below 18 requires a separate parent or lawful guardian approval process before final admission; the student’s own tick is not a substitute for that approval.",
		"For routine admission, service or refund complaints, I may contact the administration contact below and keep my supporting records. This does not restrict contacting police, regulators, consumer authorities, courts or emergency services.",
		"IDEOVERSITY will communicate proposed material changes to fees, course scope or accepted terms. My saved agreement will not be overwritten; changes requiring agreement need a fresh acceptance record. Mandatory changes in law still apply.",
		"These terms preserve my statutory rights and remedies. If a clause conflicts with applicable law, the law prevails. These are institute admission rules; they are not a statement that every clause is required or approved by the Government."
	],
	identityNotice: "IDEOVERSITY will use my ID image, camera selfie and acceptance record for admission administration, identity review and lawful dispute handling. Records will be accessible only to authorised staff and lawful recipients, protected against unauthorised access, and retained only for a documented necessary period, including any legal hold. I may contact administration about access, correction or retention of my information, subject to applicable law. Records will not be used for advertising without separate optional permission. A selfie is a camera capture, not certified identity, biometric or liveness verification.",
	// TODO: replace complaintContact with the real admin phone or email.
	beforeStartRefundTerms: "Full refund within 7 days of admission.",
	complaintContact: "IDEOVERSITY administration",
	additionalTerms: "",
	schedule: "Schedule: confirm with admissions",
	// null shows "Confirm with admissions"
	totalFeePKR: null,
};

module.exports = { COURSE_CATALOG, OUTLINE_CHECKED_ON, TERMS };
