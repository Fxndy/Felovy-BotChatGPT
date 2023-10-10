require("../config")

const {
  default: makeHutaoPregnant,
  areJidsSameUser,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  jidDecode
} = require("@whiskeysockets/baileys");
const {
  smsg
} = require("./lib/myfunc")
let low = require('./lib/lowdb')
const axios = require("axios")
const pino = require("pino")
const _ = require("lodash");
const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });
const { Low, JSONFile } = low

global.db = new Low(
  new JSONFile(`hutao.json`)
)

loadDatabase()
async function loadDatabase() {
  await global.db.read()
  global.db.data = {
    users: {},
    ...(global.db.data || {})
  }
  global.db.chain = _.chain(global.db.data)
}

if (global.db) setInterval(async () => {
  if (global.db.data) {
    await global.db.write()
  }
}, 1069)

async function felovyWangy(){
  const { state, saveCreds } = await useMultiFileAuthState(`./session`);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
  
  global.client = await makeHutaoPregnant({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ['Chrome (Linux)', '', ''],
    auth: state,
    generateHighQualityLinkPreview: true,
  });
 
  store.bind(client.ev)
  client.serializeM = (m) => smsg(client, m, store);
  
  if(!client.authState.creds.registered) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    var question = function (text) {
      return new Promise(function (resolve) {
        rl.question(text, resolve);
      });
    };
    
    const phoneNumber = await question('Silakan masukkan nomor ponsel Anda: ')
		const code = await client.requestPairingCode(phoneNumber)
		console.log(`Code: ${code}`)
  }
  
  const unhandledRejections = new Map();
  process.on("unhandledRejection", (reason, promise) => {
    unhandledRejections.set(promise, reason);
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
  });
  process.on("rejectionHandled", (promise) => {
    unhandledRejections.delete(promise);
  });
  process.on("Something went wrong", function (err) {
    console.log("Caught exception: ", err);
  });
  
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      mek = chatUpdate.messages[0];
      if (!mek.message) return;
      if (mek.key && mek.key.remoteJid === "status@broadcast") return
      if (mek.key.id.startsWith("BAE5") && mek.key.id.length === 16) return;
      m = await smsg(client, mek, store)
      
      if(!m.text) return
      if(global.pcOnly && m.isGroup) return
      
      const loadDatabase = (m) => {
        let user = global.db.data.users[m.sender]
        if (typeof user !== "object") global.db.data.users[m.sender] = {}
        
        if(user){
          if(!("messages" in user)) user.messages = [{"role": "system", "content": `Nama mu adalah Felovy, jawab pertanyaan apapun yang ditanyakan kepadamu. Jangan menulis seperti AI. Tulis dengan gaya pesan yang Anda lihat. Jangan mengajukan pertanyaan dalam pesan Anda. Anda juga dapat menggunakan emoji 😉. menggunakan bahasa Indonesia.`}]
        } else global.db.data.users[m.sender] = {
          messages: [{"role": "system", "content": `Nama mu adalah Felovy, jawab pertanyaan apapun yang ditanyakan kepadamu. Jangan menulis seperti AI. Tulis dengan gaya pesan yang Anda lihat. Jangan mengajukan pertanyaan dalam pesan Anda. Anda juga dapat menggunakan emoji 😉. menggunakan bahasa Indonesia.`}]
        }
      }
      
      loadDatabase(m)
      
      let user = global.db.data.users[m.sender] 
      
      try {
        user.messages.push({ role: "user", content: m.text })
        
        const response = (await axios.post("https://xzn.wtf/api/openai?apikey="+global.apikey, { messages: user.messages })).data
        
        user.messages.push({ role: "assistant", content: response.result })
        
        await m.reply(response.result)
        
        if(user.messages.length > 5) delete user.messages
      } catch(e) {
        console.error(e)
        await m.reply(`Sorry, AI busy. Try again later.`)
      }
    } catch (err) {
      console.error(err);
    }
  });
  
  client.ev.on("creds.update", saveCreds);
  client.ev.on("contacts.update", (update) => {
    for (let contact of update) {
      let id = client.decodeJid(contact.id);
      if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
    }
  });
  
  client.ev.on("connection.update", async (update) => {
    const { connection } = update;
    if (connection === "close") {
      felovyWangy();
    } else if (connection === "open") {
      console.log("Bot Online")
    }
  })
  
  client.getContentType = (content) => {
    if (content) {
      const keys = Object.keys(content);
      const key = keys.find(k => (k === 'conversation' || k.endsWith('Message') || k.endsWith('V2') || k.endsWith('V3')) && k !== 'senderKeyDistributionMessage');
      return key
    }
  }
  
  
  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    } else return jid;
  };
  
  client.sendText = (jid, text, quoted = "", options) => client.sendMessage(jid, { text: text, ...options }, { quoted, ...options });
  
  return client
}

felovyWangy()