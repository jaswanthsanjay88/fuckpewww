const fs = require('fs');
const path = require('path');

const ppts = [
  {
    name: "Unit-1_Overview_of_OOP_and_Java.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/35ffb106-7cfa-4b16-ad2a-5d1a4663ee3a-unit-1_overview_of_oop_and_java.pdf"
  },
  {
    name: "Unit-2_Java_Language_Basics.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/995b2569-ddc9-4020-b5e2-d72417be9963-unit-2_java_language_basics.pdf"
  },
  {
    name: "Unit-3_Arrays_and_Strings.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/bac3af76-fdab-48c8-bff5-1077a216a9fe-unit-3_arrays_and_strings.pdf"
  },
  {
    name: "Unit-4_Object_Oriented_Programming.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/7e4ae14d-090b-478a-9ba1-62166867b942-unit-4_object_oriented_programming.pdf"
  },
  {
    name: "Unit-5_Exception_Handling.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/04f4e527-d920-4bce-ae5c-c69943256e1f-unit-5_exception_handling.pdf"
  },
  {
    name: "Unit-6_Collections_Framework.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/4d590467-9626-4b26-929b-28ef53c31ffe-unit-6_collections_framework.pdf"
  },
  {
    name: "Unit-7_Advanced_Foundations.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/6ebcecc0-946f-427e-a4e3-f6a005174bca-unit-7_advanced_foundations.pdf"
  }
];

const lectureNotes = [
  {
    name: "Unit-1.1_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/c27a92cb-f7da-4df6-a2b7-5ea9ac4cd7c0-unti1.1.pdf"
  },
  {
    name: "Unit-1.2_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/88862341-b120-40bc-b5dd-80cd21a9d573-unit-1.2.pdf"
  },
  {
    name: "Unit-2.1_and_2.2_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/06bb2d9c-d82b-4878-ad34-f453e38a1588-2.1-and-2.2-lecture-notes.pdf"
  },
  {
    name: "Unit-2.3_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/34999a0f-739e-4f36-8cf7-3a27f9cdb2a5-2.3-lecture-notes.pdf"
  },
  {
    name: "Unit-2.4_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/9ea156a3-baf6-458d-8868-df17706bd946-2.4-lecture-notes.pdf"
  },
  {
    name: "Unit-3.3_and_3.4_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/93adeb7e-bed1-47e4-9bfd-9f10812d7dc2-3.3-and-3.4-lecture-notes.pdf"
  },
  {
    name: "Unit-4.1_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/55b9539b-09ae-4ae6-93c3-f75b0bb30a99-4.1-lecture-notes.pdf"
  },
  {
    name: "Unit-4.2_and_4.3_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/3951a71f-e001-4872-a092-e44915889db6-4.2-and-4.3-lecture-note.pdf"
  },
  {
    name: "Unit-5.1_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/250bc945-8308-48f1-8a44-6c43245d40b6-5.1-lecture-notes_sl.pdf"
  },
  {
    name: "Unit-5.2_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/6ff83e1e-e940-48be-b166-4126fc4ae009-5.2-lecture-notes_sl.pdf"
  },
  {
    name: "Unit-5.3_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/24b6f445-af5e-4bae-a3d3-a6b0538bb226-5.3-lecture-notes_sl.pdf"
  },
  {
    name: "Unit-5.4_Lecture_Notes.pdf",
    url: "https://edorer-parul-elearning.sgp1.digitaloceanspaces.com/important/e8c5b1dd-eca2-471c-bd3b-d1d981a524e1-5.4-lecture-notes_sl.pdf"
  }
];

const destWorkspace = path.join(__dirname, 'downloads', 'Java_Programming');
const destUserDownloads = path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads', 'Java_Programming');

async function downloadFile(item, targetDir) {
  const filePath = path.join(targetDir, item.name);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
    console.log(`[ALREADY EXISTS] ${item.name}`);
    return filePath;
  }

  process.stdout.write(`Downloading: ${item.name} ... `);
  const res = await fetch(item.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(filePath, buffer);
  console.log(`DONE (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  return filePath;
}

async function run() {
  console.log('====================================================');
  console.log('   Java Programming - All PPTs & Lecture Notes');
  console.log('====================================================\n');

  const pptsDir = path.join(destWorkspace, 'PPTs');
  const notesDir = path.join(destWorkspace, 'Lecture_Notes');
  const userPptsDir = path.join(destUserDownloads, 'PPTs');
  const userNotesDir = path.join(destUserDownloads, 'Lecture_Notes');

  [pptsDir, notesDir, userPptsDir, userNotesDir].forEach(d => fs.mkdirSync(d, { recursive: true }));

  console.log('--- 1. Downloading 7 Presentation Slides (PPTs) ---');
  for (const item of ppts) {
    const saved = await downloadFile(item, pptsDir);
    // Also copy to User's Downloads folder
    fs.copyFileSync(saved, path.join(userPptsDir, item.name));
  }

  console.log('\n--- 2. Downloading 12 Lecture Notes ---');
  for (const item of lectureNotes) {
    const saved = await downloadFile(item, notesDir);
    // Also copy to User's Downloads folder
    fs.copyFileSync(saved, path.join(userNotesDir, item.name));
  }

  console.log('\n====================================================');
  console.log('✅ ALL DOWNLOADS COMPLETE!');
  console.log(`📂 Saved in Workspace: ${destWorkspace}`);
  console.log(`📂 Saved in Downloads: ${destUserDownloads}`);
  console.log('====================================================');
}

run().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
