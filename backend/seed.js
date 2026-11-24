require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('./config/db')
const Category = require('./models/Category')
const BusinessIdea = require('./models/BusinessIdea')
const Article = require('./models/Article')
const User = require('./models/User')

const categories = [
  { name: 'ऑनलाइन कमाई', slug: 'online-income', description: 'Blog आणि YouTube वरून digital income opportunities' }
]

const ideas = [
  {
    title: 'घरबसल्या कमाई करा: Blog आणि YouTube वरून कमावण्याचे 5 रास्त उपाय',
    slug: 'ghar-bashlya-kamai-blog-youtube',
    categorySlug: 'online-income',
    description: 'घरबसल्या Blog आणि YouTube channel सुरू करून योग्य traffic आणि engaging contentच्या मदतीने कमाई करण्याचे practical मार्ग.',
    investment: 0,
    investmentLabel: '₹0+',
    machinery: ['Laptop किंवा smartphone', 'Internet connection', 'Camera किंवा mic'],
    rawMaterials: ['Quality content', 'Basic editing tools'],
    licenses: ['Google account', 'Blog/YouTube channel', 'PAN आणि बैंक खाते'],
    process: ['Niche निवडा', 'Blog किंवा YouTube channel सुरू करा', 'Regular आणि useful content publish करा', 'Traffic आणि audience वाढवा'],
    marketing: ['SEO', 'Social media promotion', 'Email newsletter', 'Audience engagement'],
    images: ['https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=88']
  }
]

const articles = [
  {
    title: 'व्यापारी आणि स्वयंरोजगार धारकांसाठी राष्ट्रीय पेन्शन योजना',
    slug: 'vyapari-pension-yojana-2025-marathi',
    category: 'सरकारी योजना',
    image: 'https://i0.wp.com/marathiudyojak.com/wp-content/uploads/2025/08/%E0%A4%B5%E0%A5%8D%E0%A4%AF%E0%A4%BE%E0%A4%AA%E0%A4%BE%E0%A4%B0%E0%A5%80-%E0%A4%B0%E0%A4%BE%E0%A4%B7%E0%A5%8D%E0%A4%9F%E0%A5%8D%E0%A4%B0%E0%A5%80%E0%A4%AF-%E0%A4%AA%E0%A5%87%E0%A4%A8%E0%A5%8D%E0%A4%B6%E0%A4%A8-%E0%A4%AF%E0%A5%8B%E0%A4%9C%E0%A4%A8%E0%A4%BE-2025-%E2%80%93-%E0%A4%AA%E0%A5%87%E0%A4%A8%E0%A5%8D%E0%A4%B6%E0%A4%A8-%E0%A4%B2%E0%A4%BE%E0%A4%AD.jpg?resize=780%2C470&ssl=1',
    ogImage: 'https://i0.wp.com/marathiudyojak.com/wp-content/uploads/2025/08/%E0%A4%B5%E0%A5%8D%E0%A4%AF%E0%A4%BE%E0%A4%AA%E0%A4%BE%E0%A4%B0%E0%A5%80-%E0%A4%B0%E0%A4%BE%E0%A4%B7%E0%A5%8D%E0%A4%9F%E0%A5%8D%E0%A4%B0%E0%A5%80%E0%A4%AF-%E0%A4%AA%E0%A5%87%E0%A4%A8%E0%A5%8D%E0%A4%B6%E0%A4%A8-%E0%A4%AF%E0%A5%8B%E0%A4%9C%E0%A4%A8%E0%A4%BE-2025-%E2%80%93-%E0%A4%AA%E0%A5%87%E0%A4%A8%E0%A5%8D%E0%A4%B6%E0%A4%A8-%E0%A4%B2%E0%A4%BE%E0%A4%AD.jpg?resize=1200%2C630&ssl=1',
    canonicalUrl: 'https://marathiudyojak.com/vyapari-pension-yojana-2025-marathi/',
    seoTitle: 'व्यापारी आणि स्वयंरोजगार धारकांसाठी राष्ट्रीय पेन्शन योजना 2025',
    seoDescription: '१८ ते ४० वयोगटातील पात्र व्यापारी आणि स्वयंरोजगार धारकांसाठी राष्ट्रीय पेन्शन योजना, पात्रता, मासिक योगदान, फायदे, कागदपत्रे आणि अर्ज प्रक्रिया जाणून घ्या.',
    tags: ['व्यापारी पेन्शन योजना', 'सरकारी योजना', 'स्वयंरोजगार', 'व्यापारी', 'पेन्शन योजना'],
    keywords: ['व्यापारी पेन्शन योजना', 'राष्ट्रीय पेन्शन योजना व्यापारी', 'स्वयंरोजगार पेन्शन योजना', 'Vyapari Pension Yojana', 'NPS for traders'],
    content: `<h2>वृद्धापकाळासाठी व्यापाऱ्यांना आधार – राष्ट्रीय पेन्शन योजना 2025</h2>
<p>लघु व्यापारी, किरकोळ विक्रेते आणि स्वयंरोजगार व्यक्तींच्या आर्थिक सुरक्षाासाठी केंद्र सरकारने व्यापारी व स्वयंरोजगार धारकांसाठी राष्ट्रीय पेन्शन योजना सुरू केली आहे. ही स्वेच्छेने व योगदानावर आधारित योजना वृद्धापकाळात नियमित पेन्शनची व्यवस्था देते.</p>
<p>योजना रजिस्ट्रेशननंतर लाभार्थी ६० वर्षे पूर्ण करताना किमान दरमहा ₹3,000 पेन्शन मिळवू शकतो. वास्तविक पेन्शन रक्कम जमा योगदान, वय आणि निवडलेल्या विकल्पांवर अवलंबून असते.</p>

<h2>योजनेची प्रमुख उद्दिष्टे</h2>
<ol>
  <li>वृद्धापकाळात लघु व्यापारी आणि उद्योजकांना स्थिर आर्थिक आधार उपलब्ध करणे.</li>
  <li>लाभार्थीच्या मृत्यूनंतर कुटुंबाला उपलब्ध सुरक्षा राखणे.</li>
  <li>असंघटित क्षेत्रातील कामगार आणि व्यापाऱ्यांना सामाजिक सुरक्षा कवच देणे.</li>
  <li>राष्ट्राच्या आर्थिक विकासात योगदान देणाऱ्या लघु व्यापाऱ्यांचे सामाजिक संरक्षण वाढवणे.</li>
</ol>

<h2>योजनेची मुख्य वैशिष्ट्ये</h2>
<ul>
  <li>६० वर्षांनंतर नियमित पेन्शनचा आधार.</li>
  <li>किमान निर्धारित पेन्शन दरमहा ₹3,000 पर्यंत, योगदान पद्धतीनुसार.</li>
  <li>मृत्यूनंतर पात्र जोडीदाराला निर्धारित फॅमिली पेन्शनचा पर्याय.</li>
  <li>व्यवसाय आणि नोंदणी वयोमर्यादा यांसाठी स्पष्ट निकष.</li>
  <li>आधार आणि बँक खात्याच्या आधारे CSC केंद्रातून नोंदणी.</li>
</ul>

<h2>पेन्शन योगदानाचे वयोमानानुसार नमुना</h2>
<table>
  <thead><tr><th>नोंदणीच्या वेळी वय</th><th>अंदाजे मासिक योगदान</th></tr></thead>
  <tbody>
    <tr><td>१८ वर्षे</td><td>₹55</td></tr>
    <tr><td>२५ वर्षे</td><td>₹85</td></tr>
    <tr><td>३० वर्षे</td><td>₹100</td></tr>
    <tr><td>३५ वर्षे</td><td>₹150</td></tr>
    <tr><td>४० वर्षे</td><td>₹200</td></tr>
  </tbody>
</table>
<p>नोंदणी करताना वय जितके कमी तितके मासिक योगदान कमी असू शकते. अचूक सध्याची रक्कम नोंदणीच्या वेळी अधिकृत CSC प्रणालीत पडताळून घ्यावी.</p>

<h2>योजनेचे फायदे</h2>
<h3>१) वृद्धापकाळाचे नियमित उत्पन्न</h3>
<p>योग्य वयोमर्यादेत आणि निर्धारित योगदान पद्धतीनुसार नोंदणी केलेल्या लाभार्थ्याला ६० वर्षांनंतर नियमित पेन्शन उपलब्ध होऊ शकते.</p>
<h3>२) फॅमिली पेन्शन</h3>
<p>लाभार्थ्याच्या मृत्यूनंतर पात्र जोडीदाराला नोंदणीनुसार फॅमिली पेन्शनाचा लाभ मिळतो. सर्वसाधारणपणे ५०% पेन्शन संबंधित जोडीदाराला देण्याचा नमुना असतो.</p>
<h3>३) स्थायी अपंगत्वातील सुरक्षा</h3>
<p>६० वर्षांपूर्वी कायमस्वरूपी अपंगत्व झाल्यास जोडीदारासाठी नोंदणी सुरू ठेवण्याचा किंवा नियमांनुसार योगदान परत घेण्याचा पर्याय असू शकतो.</p>
<h3>४) योजना सोडण्याच्या परिस्थितीतील परतावा</h3>
<p>दाखला आणि योगदान गुंतवणूक कायद्यांनुसार योजना सोडण्याच्या कालावधीवर परताव्याचे नियम बदलू शकतात. १० वर्षांपूर्वी खाते बंद केल्यास स्वतःचे योगदान परत मिळू शकते; नंतरच्या कालावधीचा लाभ व व्याज नियमांनुसार लागू होतो.</p>

<h2>पात्रता निकष</h2>
<ul>
  <li>दुकानदार, किरकोळ विक्रेता, दलाल, कमिशन एजंट आणि स्वयंरोजगार व्यक्ती पात्र असू शकतात.</li>
  <li>नोंदणीच्या वेळी वय १८ ते ४० वर्षे असावे.</li>
  <li>वार्षिक व्यवसाय उलाढाल निर्धारित मर्यादेच्या आत असावी—स्रोत लेखानुसार ₹1.5 कोटींपेक्षा कमी.</li>
</ul>

<h2>अपात्र व्यक्ती</h2>
<p>खालीलपैकी अटी लागू होऊ शकतील:</p>
<ul>
  <li>आयकर भरारी व्यक्ती किंवा संस्था.</li>
  <li>EPFO, ESIC किंवा NPS मधील सक्रिय सदस्य.</li>
  <li>प्रधानमंत्री श्रमयोगी मानधन किंवा इतर केंद्राशी जोडलेली मानधन योजना पूर्ण लाभ मिळवत असलेले सदस्य.</li>
</ul>

<h2>अर्ज कसा करावा</h2>
<ol>
  <li>जवळच्या अधिकृत Common Service Centre (CSC) ला भेट द्या.</li>
  <li>आधार कार्ड, बँक खाते, पासबुक किंवा योग्य बँक खात्याचा पुरावा सोबत घ्या.</li>
  <li>योग्य मासिक योजना आणि वैयक्तिक माहिती CSC ऑपरेटरकडे सादर करा.</li>
  <li>आधार आधारित OTP प्रमाणीकरण पूर्ण करा.</li>
  <li>वय, मोबाईल नंबर, ईमेल, वार्षिक उलाढाल आणि GSTIN असल्यास त्याचा तपशील भरा.</li>
  <li>नोंदणीसाठी प्रथम मासिक किंवा आवश्यक योगदान भरा.</li>
  <li>स्वयं-डिक्लेरेशन पूर्ण करा आणि VPAN किंवा पेन्शन नोंदणी क्रमांक प्राप्त करा.</li>
</ol>

<h2>आवश्यक कागदपत्रे</h2>
<ul>
  <li>आधार कार्ड.</li>
  <li>सक्रिय बचत, जनधन किंवा व्यवसाय बँक खाते.</li>
  <li>IFSC तपशील आणि बँक पासबुक/स्टेटमेंट/चेक लीफ.</li>
  <li>मोबाइल OTP उपलब्ध होण्यासाठी सक्रिय मोबाइल नंबर.</li>
  <li>लागू असल्यास GSTIN आणि वार्षिक उलाढालीचा पुरावा.</li>
</ul>

<h2>वारंवार विचारले जाणारे प्रश्न</h2>
<h3>योजनाचा लाभ कोणाला मिळतो?</h3>
<p>१८ ते ४० वयोगटातील पात्र लघु व्यापारी, किरकोळ विक्रेते आणि स्वयंरोजगार व्यक्ती यांना ही योजना लागू असू शकते.</p>
<h3>पेन्शन किती मिळते?</h3>
<p>अटी पूर्ण असल्यास ६० वर्षांनंतर साधारण किमान ₹3,000 प्रती महिना पेन्शनचा उद्देश आहे.</p>
<h3>नोंदणी कुठे करावी?</h3>
<p>जवळच्या अधिकृत CSC केंद्रात आधार आणि बँक तपशीलासह नोंदणी करता येते.</p>
<h3>वयाचा पुरावा बदलता येतो का?</h3>
<p>आधारवरील जन्मतारीख पुरावा म्हणून वापरला जातो; नोंदणीनंतर बदल करण्यासाठी विशेष प्रक्रिया आणि अधिकृत नियम लागू असू शकतात.</p>

<h2>उदाहरणाने समजून घ्या</h2>
<p>२५ वर्षांचा किरकोळ दुकानदार नियमित योगदान घेतो आणि ६० वर्षांपर्यंत नोंदणी कायम ठेवतो, तर त्याला ३५ वर्षांनंतर या योजना अंतर्गत निर्धारित पेन्शन मिळू शकते. लाभार्थ्याच्या निधनानंतर पात्र जोडीदाराला नोंदणीनुसार फॅमिली पेन्शन लागू होऊ शकते.</p>

<h2>निष्कर्ष</h2>
<p>व्यापारी आणि स्वयंरोजगार धारकांसाठी राष्ट्रीय पेन्शन योजना लघु व्यापाऱ्यांना वृद्धापकाळातील आर्थिक योजना करण्यासाठी मदत करते. अर्ज करण्यापूर्वी स्वतःच्या वय, वार्षिक उलढाल, विद्यमान EPFO/ESIC/NPS सदस्यत्व आणि सध्याचे अधिकृत नियम तपासणे आवश्यक आहे.</p>
<p>अधिकृत नोंदणी आणि फायदे नियमितपणे जारी केलेल्या शासनाच्या सूचनांनुसारच प्रमाणित करावेत.</p>`,
    isPublished: true,
    publicationDate: new Date('2025-08-21')
  }
]

async function seed() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured before seeding')
  }
  await connectDB()
  let admin = await User.findOne({ email: process.env.ADMIN_EMAIL })
  if (!admin) {
    admin = await User.create({
      name: process.env.ADMIN_NAME || 'Marathi Udyojak ',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
      isActive: true
    })
  }
  for (const category of categories) {
    await Category.findOneAndUpdate(
      { slug: category.slug },
      { $setOnInsert: category },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
  }
  for (const idea of ideas) {
    const category = await Category.findOne({ slug: idea.categorySlug })
    if (!category) throw new Error(`Seed category "${idea.categorySlug}" could not be loaded`)
    const { categorySlug, ...data } = idea
    await BusinessIdea.findOneAndUpdate(
      { slug: data.slug },
      { $setOnInsert: { ...data, category: category._id, isPublished: true } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
  }
  for (const article of articles) {
    await Article.findOneAndUpdate(
      { slug: article.slug },
      { $setOnInsert: { ...article, author: admin._id } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
  }
  console.log('Seeded missing Marathi Udyojak records without modifying existing documents')
  await mongoose.disconnect()
}

seed().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect()
  process.exit(1)
})
