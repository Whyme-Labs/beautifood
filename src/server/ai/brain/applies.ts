// What in a guest's message doesn't apply to this meal, taken out before what they avoid is read:
//   - said of the past and since outgrown: "I used to be vegetarian, these days I eat everything",
//     "dulu alah susu, sekarang dah ok", 小时候对虾过敏，长大就好了;
//   - said of someone who isn't here: "my friend is vegan but she couldn't make it", "kawan saya alah
//     udang tapi dia tak datang", 我老公海鲜过敏，不过他今天出差;
//   - denied: "not Muslim btw", "I'm not vegan or anything", "saya tak alah telur pun", 我不是过敏;
//   - asked hypothetically or out of curiosity: "if a customer had a nut allergy, ...", "asking for a
//     blog post", "saja nak tahu", 只是问问.
// Each part is a clause; a part taken out leaves its punctuation, so the rest reads as before.

// clauses: split at punctuation and at "but", "tapi", 不过, keeping the separators
const SPLIT = /([.!?。！？;；,，\n]+|\s[-–—]\s|\s(?=(?:but|tapi|though|however|cuma)\b)|(?=不过|但是|可是))/i;

const PAST = /\b(used to|use to|as a (kid|child|baby|teen|teenager)|when i was (a )?(kid|child|baby|young|little|small|younger)|growing up|in the past|previously|last time|years ago|dulu|dahulu|masa (kecil|bayi|budak|belajar|sekolah|muda|kanak)|pernah|ingatkan|ingat (saya|sy|aku))\b|以前|小时候|从前|过去|曾经|本来/i;
const RESOLVED = /\b(grew out|grown out|outgrew|outgrown|not any ?more|no more|no longer|now (i|it s|its|it is|ok|okay|fine|can|eat|i m|im)|these days|nowadays|dah (ok|okay|baik|sembuh|boleh|hilang)|sekarang|tak lagi|tidak lagi|rupanya tak|rupa rupanya tak|turns? out (i m |im |i am |she s |he s |it s )?(not|fine|ok)|(test|tests) (came back |come back |was |were |is |are )?(clear|negative|fine|ok|normal))\b|现在|好了|没事了|不再|长大/i;
// a test that came back clear, or "turns out I'm not", rules out what the same clause says
const CLEARED = /\b(allerg\w* (test|tests)|test(s)? for allerg\w*)\b.*\b(clear|negative|fine|normal)\b|\b(rupanya|rupa rupanya|turns? out)\b.*\b(tak|not|bukan)\b/i;

const PERSON = /\b(friend|friends|colleague|colleagues|coworker|co worker|boss|brother|sister|bro|sis|mum|mom|mother|dad|father|wife|husband|hubby|partner|son|daughter|kid|kids|child|girlfriend|boyfriend|gf|bf|uncle|aunt|auntie|aunty|grandma|grandpa|grandmother|grandfather|cousin|in law|nephew|niece|he|she|they|kawan|rakan|abang|adik|kakak|mak|emak|ibu|ayah|bapa|bapak|isteri|suami|anak|pakcik|makcik|nenek|datuk|atuk|tok|sepupu|bos|dia|mereka)\b|朋友|同事|老板|哥|姐|弟|妹|妈|爸|老婆|老公|太太|先生|儿子|女儿|孩子|小孩|叔|姨|奶奶|爷爷|外婆|外公|他|她/i;
const ABSENT = /\b(isn t|isnt|is not|aren t|arent|are not|not|didn t|didnt|did not|won t|wont|will not|couldn t|couldnt|could not|can t|cant|cannot)\s+(be\s+)?(coming|come|joining|join|here|make it|with us|around|able to (come|make it|join))\b|\b(stayed|staying|stays) (at )?(home|back|behind)\b|\b(wfh|work(ing|s)? from home|outstation|overseas|out of town|on leave)\b|\bis (in|at) [a-z]+ (this week|today|tonight|now)\b|\b(next time|another (day|time))\b|\b(tak|tidak|x|tk|takkan|tak dapat|tak boleh)\s+(datang|ikut|join|sertai|turut)\b|\b(lain kali|kerja dari rumah)\b|(没|不|没有)(来|跟来|一起来|过来|在)|出差|在外地|下次|改天/i;

const DENIED = /\b(not|isn t|isnt|aren t|arent|never been|no longer|bukan|tak|tidak|x|tk)\s+(a |an |really |actually |seorang |orang )?(muslim|muslims|islam|vegetarian|vegan|veg|veggie|vege|allergic|alergik|alah|alergi|intolerant|coeliac|celiac)\b|\bno (food )?(allerg(y|ies)|intoleranc(e|es|ies))\b|\b(tak|tiada|takde|tak ada|tidak ada) (alahan|alergi)\b|不是(穆斯林|回教|伊斯兰|吃素|素食|过敏)|(没有|没|无|不)过敏|不用吃素|不吃素/i;
const EXCEPT = /\b(except|other than|apart from|besides|but|selain|kecuali)\b|除了/i;

const HYPOTHETICAL = /\b(if|what if|suppose|supposing|kalau|jika|sekiranya|andai(kata)?)\b[^.?!]{0,40}\b(customer|customers|someone|somebody|anyone|a guest|guests|people|pelanggan|orang|seseorang|sesiapa)\b|(如果|假如|要是)有?(人|客人|顾客)/i;
const CURIOUS = /\b(just (curious|asking|wondering)|out of curiosity|asking for (a|my|the) (blog|article|post|review|story|friend|work)|for (a|my) (blog|article|review|food blog)|saja (nak )?(tanya|tahu)|sekadar (tanya|bertanya|nak tahu)|cuma (nak )?tanya)\b|只是问问|随便问问|好奇|问一下而已/i;

// "only vegetarian on Wednesdays", and today is another day
const ONLY_ON = /\bonly\b.*\bon (mon|tues|wednes|thurs|fri|satur|sun)days?\b/i;
const TODAY = /\btoday( is|'s| s)? (mon|tues|wednes|thurs|fri|satur|sun)day\b/i;

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, " ");

/** `question` with the parts that don't apply to this meal taken out (itself when every part does). */
export function applicable(question: string): string {
  // (split with one capturing group: the said parts at even places, their separators between)
  const parts = question.split(SPLIT);
  const said = parts.map((p, k) => ({ p, k, t: norm(p) })).filter((x) => x.k % 2 === 0 && x.p.trim());
  if (said.length === 0) return question;
  const whole = norm(question);
  const out = new Set<number>();
  const resolved = RESOLVED.test(whole);
  const curious = CURIOUS.test(whole);
  said.forEach(({ k, t }, i) => {
    if (CLEARED.test(t)) out.add(k);
    if (resolved && PAST.test(t)) out.add(k);
    if (DENIED.test(t) && !EXCEPT.test(t)) out.add(k);
    if (HYPOTHETICAL.test(t)) out.add(k);
    const only = t.match(ONLY_ON)?.[1];
    const today = whole.match(TODAY)?.[2];
    if (only && today && only !== today) out.add(k);
    if (curious && (CURIOUS.test(t) || /[?？吗]\s*$/.test(parts.slice(k, k + 2).join("")))) out.add(k);
    if (ABSENT.test(t)) {
      // the absence, and who it is: in the same clause, or the clause before ("my friend is vegan, but she can't make it")
      out.add(k);
      if (!PERSON.test(t.replace(/\b(he|she|they|dia|mereka)\b|他|她/g, "")) && i > 0 && PERSON.test(said[i - 1].t)) out.add(said[i - 1].k);
    }
  });
  if (!out.size) return question;
  return parts.map((p, k) => (out.has(k) ? " " : p)).join("");
}

/** Diets the message says the guest isn't ("I'm not vegetarian", "bukan Muslim", 不是吃素的): not read from its other words either. */
export function deniedDiets(question: string): ("vegetarian" | "vegan" | "halal")[] {
  const t = norm(question);
  const out: ("vegetarian" | "vegan" | "halal")[] = [];
  const no = "(not|isn t|isnt|aren t|arent|never been|no longer|bukan|tak|tidak|x|tk)\\s+(a |an |really |actually |seorang |orang )?";
  if (new RegExp(`\\b${no}(vegetarian|veg|veggie|vege)\\b`).test(t) || /不是吃素|不是素食|不吃素|不用吃素/.test(t)) out.push("vegetarian");
  if (new RegExp(`\\b${no}vegan\\b`).test(t) || /不是纯素/.test(t)) out.push("vegan");
  if (new RegExp(`\\b${no}(muslim|muslims|islam)\\b`).test(t) || /不是(穆斯林|回教|伊斯兰)/.test(t)) out.push("halal");
  return out;
}

/** A dislike, not a need: "I just don't like it", "not a fan", "tak suka", 不喜欢. */
export const DISLIKE = /\b(i|we|he|she|they)( just| really| simply)? (don t|dont|do not|doesn t|doesnt) (like|fancy|enjoy|love)\b|\bnot a (big )?fan\b|\b(tak|x|tk|tidak|kurang) (berapa )?(suka|gemar|minat)\b|不喜欢|不爱吃|不太喜欢/i;

/** A dish's own leave-off, said as one ("don't put egg in my maggi", "nasi goreng saya tak nak telur", "炒面不要加蛋"). */
export const LEAVE_OFF = /\b(don t put|dont put|do not put|hold the|leave out the|take out the|without the)\b|\bno \w+( \w+)? (in|on|for) (my|the|this|that|his|her)\b|\b(tak nak|x nak|tak mau|tanpa|jangan (letak|bubuh|masuk|taruh|tabur))\b.*\b(dalam|atas)\b|^\s*\S+( \S+)? (saya|sy|aku) (tak nak|x nak|tak mau|tanpa)\b|不要加|不要放|别加|别放|少放/i;
