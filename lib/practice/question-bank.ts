import type { SubjectId } from "@/types";

export const GRADE_LEVELS = [
  "초1", "초2", "초3", "초4", "초5", "초6",
  "중1", "중2", "중3", "고1", "고2", "고3",
] as const;

export type GradeLevel = (typeof GRADE_LEVELS)[number];

export interface PracticeQuestion {
  key: string;
  gradeLevel: GradeLevel;
  subjectId: SubjectId;
  unitName: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  content: string;
  choices: string[];
  answer: string;
  explanation: string;
}

type Concept = [term: string, description: string];

const SOCIAL_CONCEPTS: Record<GradeLevel, Concept[]> = {
  초1: [["가족", "함께 생활하며 서로 돕는 사람들"], ["약속", "함께 지키기로 정한 것"], ["이웃", "가까운 곳에 함께 사는 사람"], ["공공장소", "여러 사람이 함께 이용하는 곳"]],
  초2: [["마을", "여러 사람이 모여 생활하는 곳"], ["지도", "장소의 위치를 줄여 나타낸 그림"], ["직업", "사람들이 맡아 하는 일"], ["전통", "오랫동안 이어 내려오는 생활 모습"]],
  초3: [["고장", "사람들이 생활하는 일정한 지역"], ["방위", "동서남북으로 위치를 나타내는 기준"], ["문화유산", "옛사람에게 물려받아 보존할 가치가 있는 것"], ["생산", "필요한 물건이나 서비스를 만드는 활동"]],
  초4: [["축척", "실제 거리를 일정한 비율로 줄인 정도"], ["지방자치", "지역 주민이 지역의 일을 스스로 처리하는 제도"], ["공공기관", "주민 생활에 필요한 공적인 일을 하는 기관"], ["촌락", "농업·어업 등을 중심으로 생활하는 지역"]],
  초5: [["인권", "사람이라면 누구나 누려야 할 기본 권리"], ["법", "사회 구성원이 지켜야 할 공식적인 규칙"], ["민주주의", "국민이 주인이 되어 나라를 다스리는 원리"], ["시장", "재화와 서비스가 거래되는 곳이나 관계"]],
  초6: [["국회", "법률을 만들고 정부를 감시하는 국가 기관"], ["삼권분립", "국가 권력을 입법·행정·사법으로 나누는 원리"], ["세계화", "나라 사이의 교류와 의존이 커지는 현상"], ["무역", "나라와 나라 사이에 상품이나 서비스를 사고파는 활동"]],
  중1: [["위도", "적도를 기준으로 남북 위치를 나타낸 값"], ["경도", "본초 자오선을 기준으로 동서 위치를 나타낸 값"], ["문화 상대주의", "다른 문화를 그 사회의 맥락에서 이해하는 태도"], ["사회화", "사회의 가치와 행동 방식을 배우는 과정"]],
  중2: [["수요", "소비자가 상품을 사고자 하는 욕구"], ["공급", "생산자가 상품을 팔고자 하는 양"], ["기회비용", "한 선택 때문에 포기한 것 중 가장 가치가 큰 것"], ["헌법", "국민의 기본권과 국가 운영 원리를 정한 최고 법"]],
  중3: [["국민주권", "국가의 의사를 결정하는 최고 권력이 국민에게 있다는 원리"], ["인플레이션", "물가가 지속적으로 오르고 화폐 가치가 떨어지는 현상"], ["환율", "두 나라 화폐 사이의 교환 비율"], ["지속가능발전", "미래 세대의 필요를 해치지 않으며 이루는 발전"]],
  고1: [["사회계약설", "국가가 개인들의 합의로 성립했다는 사상"], ["문화 변동", "문화 요소가 시간에 따라 달라지는 현상"], ["외부효과", "경제 활동이 제삼자에게 대가 없이 주는 영향"], ["기본권", "헌법이 보장하는 국민의 기본적인 권리"]],
  고2: [["비교우위", "다른 생산자보다 더 낮은 기회비용으로 생산하는 능력"], ["정치 참여", "시민이 정치적 의사 결정 과정에 영향을 주는 활동"], ["사회 불평등", "희소한 자원이 사회 구성원에게 차등 분배된 상태"], ["국제법", "국가와 국제기구 사이의 관계를 규율하는 법"]],
  고3: [["경기순환", "경제 활동이 확장과 수축을 반복하는 현상"], ["공공재", "비경합성과 비배제성을 지닌 재화"], ["법치주의", "국가 권력이 법에 근거하고 법에 따라 행사되어야 한다는 원리"], ["다문화주의", "다양한 문화의 공존과 동등한 가치를 인정하는 관점"]],
};

const SCIENCE_CONCEPTS: Record<GradeLevel, Concept[]> = {
  초1: [["생물", "살아 있으며 자라고 번식하는 것"], ["계절", "날씨와 자연 모습이 주기적으로 달라지는 시기"], ["그림자", "빛이 물체에 막혀 어둡게 보이는 부분"], ["감각", "눈·코·귀·혀·피부로 주변을 느끼는 작용"]],
  초2: [["서식지", "생물이 살아가는 장소"], ["증발", "액체가 기체로 변하는 현상"], ["자석", "철로 된 물체를 끌어당기는 성질을 가진 물체"], ["날씨", "한 장소에서 짧은 기간 나타나는 대기의 상태"]],
  초3: [["광합성", "식물이 빛을 이용해 양분을 만드는 과정"], ["용해", "한 물질이 다른 물질에 고르게 섞이는 현상"], ["퇴적암", "운반된 알갱이가 쌓이고 굳어 만들어진 암석"], ["소리", "물체의 진동이 전달되어 들리는 현상"]],
  초4: [["증산작용", "식물 잎의 기공을 통해 물이 수증기로 빠져나가는 현상"], ["응결", "기체가 액체로 변하는 현상"], ["화산", "마그마가 지표 밖으로 분출하는 지형"], ["지층", "퇴적물이 층층이 쌓여 만들어진 구조"]],
  초5: [["용질", "용액에서 녹는 물질"], ["용매", "용질을 녹이는 물질"], ["태양계", "태양과 그 주위를 도는 천체로 이루어진 계"], ["생태계", "생물 요소와 비생물 요소가 서로 영향을 주는 체계"]],
  초6: [["연소", "물질이 산소와 빠르게 반응하며 빛과 열을 내는 현상"], ["전류", "전하가 일정한 방향으로 흐르는 현상"], ["렌즈", "빛을 굴절시켜 모으거나 퍼지게 하는 투명한 물체"], ["유전", "부모의 형질이 자손에게 전달되는 현상"]],
  중1: [["밀도", "단위 부피당 물질의 질량"], ["상태변화", "물질의 고체·액체·기체 상태가 바뀌는 현상"], ["탄성력", "변형된 물체가 원래 모양으로 돌아가려는 힘"], ["지구계", "기권·수권·지권·생물권이 상호작용하는 체계"]],
  중2: [["원소", "한 종류의 원자로 이루어진 순물질"], ["이온", "전자를 잃거나 얻어 전하를 띠는 입자"], ["옴의 법칙", "전류가 전압에 비례하고 저항에 반비례한다는 관계"], ["대류", "유체가 직접 이동하며 열을 전달하는 방식"]],
  중3: [["체세포분열", "한 세포가 유전적으로 같은 두 세포로 나뉘는 과정"], ["등가속도운동", "속도가 일정한 비율로 변하는 운동"], ["화학반응식", "화학 반응을 화학식과 계수로 나타낸 식"], ["별의 연주시차", "지구 공전 때문에 가까운 별의 위치가 달라 보이는 각"]],
  고1: [["산화환원", "전자 이동이나 산화수 변화가 일어나는 반응"], ["판구조론", "지각판의 이동으로 지질 현상을 설명하는 이론"], ["자연선택", "환경에 유리한 형질을 가진 개체가 더 많이 번식하는 과정"], ["전자기유도", "자기장 변화로 전류가 생기는 현상"]],
  고2: [["운동량", "질량과 속도의 곱으로 나타내는 운동 상태의 양"], ["화학평형", "정반응과 역반응의 속도가 같아진 동적 상태"], ["항상성", "생물이 몸속 환경을 일정하게 유지하는 성질"], ["지질시대", "지층과 화석을 기준으로 나눈 지구 역사의 시대"]],
  고3: [["엔트로피", "계의 무질서도나 가능한 미시 상태 수와 관련된 양"], ["유전자발현", "유전 정보로 RNA나 단백질이 만들어지는 과정"], ["반감기", "방사성 원소의 양이 절반으로 줄어드는 시간"], ["도플러효과", "파원과 관측자의 상대 운동으로 진동수가 달라 보이는 현상"]],
};

const ENGLISH_WORDS: Record<GradeLevel, Concept[]> = {
  초1: [["apple", "사과"], ["book", "책"], ["cat", "고양이"], ["red", "빨간색"]],
  초2: [["family", "가족"], ["school", "학교"], ["friend", "친구"], ["happy", "행복한"]],
  초3: [["morning", "아침"], ["window", "창문"], ["animal", "동물"], ["small", "작은"]],
  초4: [["usually", "보통"], ["library", "도서관"], ["weather", "날씨"], ["favorite", "가장 좋아하는"]],
  초5: [["invite", "초대하다"], ["healthy", "건강한"], ["because", "왜냐하면"], ["future", "미래"]],
  초6: [["experience", "경험"], ["protect", "보호하다"], ["different", "다른"], ["environment", "환경"]],
  중1: [["decide", "결정하다"], ["important", "중요한"], ["culture", "문화"], ["practice", "연습하다"]],
  중2: [["achieve", "성취하다"], ["communicate", "의사소통하다"], ["provide", "제공하다"], ["instead", "대신에"]],
  중3: [["perspective", "관점"], ["contribute", "기여하다"], ["significant", "중요한"], ["maintain", "유지하다"]],
  고1: [["inevitable", "불가피한"], ["interpret", "해석하다"], ["demonstrate", "입증하다"], ["consequence", "결과"]],
  고2: [["ambiguous", "모호한"], ["substantial", "상당한"], ["contradict", "모순되다"], ["hypothesis", "가설"]],
  고3: [["meticulous", "매우 꼼꼼한"], ["ubiquitous", "어디에나 있는"], ["deteriorate", "악화되다"], ["comprehensive", "포괄적인"]],
};

const MATH_UNITS: Record<GradeLevel, string[]> = {
  초1: ["덧셈", "뺄셈", "수 비교", "규칙 찾기"], 초2: ["두 자리 수", "곱셈", "길이", "시각"],
  초3: ["곱셈과 나눗셈", "분수", "들이와 무게", "도형"], 초4: ["큰 수", "분수", "각도", "막대그래프"],
  초5: ["분수의 계산", "소수의 계산", "넓이", "평균"], 초6: ["비와 비율", "분수의 나눗셈", "원의 넓이", "비례식"],
  중1: ["정수와 유리수", "일차방정식", "좌표", "확률"], 중2: ["연립방정식", "일차함수", "피타고라스", "확률"],
  중3: ["제곱근", "이차방정식", "이차함수", "통계"], 고1: ["다항식", "방정식", "경우의 수", "함수"],
  고2: ["수열", "지수와 로그", "삼각함수", "극한"], 고3: ["미분", "적분", "확률과 통계", "벡터"],
};

function rotate<T>(items: T[], by: number) {
  const offset = by % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function numericChoices(answer: number, index: number, suffix = "") {
  const values = [answer, answer + 1, answer - 1, answer + 2]
    .filter((value, position, array) => value >= 0 && array.indexOf(value) === position);
  while (values.length < 4) values.push(answer + values.length + 2);
  return rotate(values.slice(0, 4).map((value) => `${value}${suffix}`), index);
}

function mathQuestion(grade: GradeLevel, index: number): Omit<PracticeQuestion, "key" | "gradeLevel" | "subjectId"> {
  const rank = GRADE_LEVELS.indexOf(grade) + 1;
  const type = index % 4;
  const variant = Math.floor(index / 4) + 1;
  const unitName = MATH_UNITS[grade][type]!;
  let content: string;
  let answer: number;
  let explanation: string;

  if (rank <= 3) {
    const a = rank * 4 + variant * 2 + type;
    const b = variant + type + 1;
    if (type === 0) { answer = a + b; content = `${a} + ${b}의 값은?`; explanation = `${a}와 ${b}를 더하면 ${answer}입니다.`; }
    else if (type === 1) { answer = a; content = `${a + b} - ${b}의 값은?`; explanation = `${a + b}에서 ${b}를 빼면 ${answer}입니다.`; }
    else if (type === 2) { answer = Math.max(a, b); content = `${a}와 ${b} 중 더 큰 수는?`; explanation = `${answer}이 더 큰 수입니다.`; }
    else { answer = a + 4; content = `수의 규칙 ${a}, ${a + 2}, ___, ${a + 6}에서 빈칸은?`; explanation = `2씩 커지는 규칙이므로 ${answer}입니다.`; }
  } else if (rank <= 6) {
    const base = variant + rank;
    if (type === 0) { answer = base + variant; content = `분모가 ${base + variant + 1}인 분수 ${base}/${base + variant + 1}와 ${variant}/${base + variant + 1}의 합의 분자는?`; explanation = `분모가 같으므로 분자를 더해 ${answer}입니다.`; }
    else if (type === 1) { answer = 2 * (base + variant + 2); content = `가로 ${base}cm, 세로 ${variant + 2}cm인 직사각형의 둘레는?`; explanation = `(${base} + ${variant + 2}) × 2 = ${answer}cm입니다.`; }
    else if (type === 2) { answer = base + 2; content = `${base}, ${base + 2}, ${base + 4}의 평균은?`; explanation = `세 수의 합을 3으로 나누면 ${answer}입니다.`; }
    else { answer = base * 10; content = `${base}의 10배는?`; explanation = `${base} × 10 = ${answer}입니다.`; }
  } else if (rank <= 9) {
    const a = variant + rank;
    if (type === 0) { answer = variant + 2; content = `방정식 x + ${a} = ${a + variant + 2}의 해는?`; explanation = `양변에서 ${a}를 빼면 x = ${answer}입니다.`; }
    else if (type === 1) { answer = a - variant; content = `${a} + (-${variant})의 값은?`; explanation = `양수 ${a}에서 ${variant}를 뺀 값과 같아 ${answer}입니다.`; }
    else if (type === 2) { answer = variant; content = `주머니에 빨간 공 ${variant}개와 파란 공 ${a}개가 있다. 빨간 공의 개수는?`; explanation = `문제에서 빨간 공은 ${answer}개라고 주어졌습니다.`; }
    else { answer = 5 * variant; content = `직각삼각형의 두 직각변이 ${3 * variant}, ${4 * variant}일 때 빗변의 길이는?`; explanation = `3:4:5 직각삼각형을 ${variant}배 한 것이므로 ${answer}입니다.`; }
  } else if (rank === 10) {
    if (type === 0) { answer = variant * variant + 2 * variant; content = `다항식 x² + 2x에 x=${variant}을 대입한 값은?`; explanation = `${variant}² + 2×${variant} = ${answer}입니다.`; }
    else if (type === 1) { answer = variant; content = `(x-${variant})(x+${variant + 1})=0의 양의 해는?`; explanation = `두 해 중 양의 해는 ${answer}입니다.`; }
    else if (type === 2) { answer = (variant + 2) * (variant + 1); content = `${variant + 2}명 중 회장과 부회장을 한 명씩 뽑는 경우의 수는?`; explanation = `순서를 고려해 ${variant + 2}×${variant + 1}=${answer}입니다.`; }
    else { answer = variant + 1; content = `직선 y=${variant + 1}x+${variant}의 기울기는?`; explanation = `y=ax+b에서 기울기는 x의 계수이므로 ${answer}입니다.`; }
  } else if (rank === 11) {
    if (type === 0) { answer = 2 + (variant - 1) * 3; content = `첫째항이 2, 공차가 3인 등차수열의 제${variant}항은?`; explanation = `2+(${variant}-1)×3=${answer}입니다.`; }
    else if (type === 1) { answer = variant; content = `log₂(2^${variant})의 값은?`; explanation = `로그와 지수는 역연산이므로 ${answer}입니다.`; }
    else if (type === 2) { answer = variant; content = `${variant} × sin 90°의 값은?`; explanation = `sin 90°는 1이므로 ${variant} × 1 = ${answer}입니다.`; }
    else { answer = variant + 1; content = `수열 1, 2, ..., ${variant + 1}의 항의 개수는?`; explanation = `1부터 ${variant + 1}까지이므로 ${answer}개입니다.`; }
  } else {
    if (type === 0) { answer = 2 * variant; content = `함수 f(x)=x²의 x=${variant}에서의 미분계수는?`; explanation = `f'(x)=2x이므로 ${answer}입니다.`; }
    else if (type === 1) { answer = variant * variant; content = `0부터 ${variant}까지 2x를 적분한 값은?`; explanation = `[x²]₀^${variant}=${answer}입니다.`; }
    else if (type === 2) { answer = variant + 1; content = `서로 다른 ${variant + 1}개 자료의 개수는?`; explanation = `주어진 자료는 ${answer}개입니다.`; }
    else { answer = 5 * variant; content = `벡터 (${3 * variant}, ${4 * variant})의 크기는?`; explanation = `√((${3 * variant})²+(${4 * variant})²)=${answer}입니다.`; }
  }

  const answerText = String(answer);
  return { unitName, difficulty: Math.min(5, Math.ceil(rank / 3)) as 1 | 2 | 3 | 4 | 5, content, choices: numericChoices(answer, index), answer: answerText, explanation };
}

function conceptQuestion(
  grade: GradeLevel,
  subjectId: "social" | "science",
  index: number,
): Omit<PracticeQuestion, "key" | "gradeLevel" | "subjectId"> {
  const concepts = subjectId === "social" ? SOCIAL_CONCEPTS[grade] : SCIENCE_CONCEPTS[grade];
  const concept = concepts[index % concepts.length]!;
  const prompts = ["다음 설명에 해당하는 용어는?", "설명과 가장 잘 맞는 개념을 고르세요.", "빈칸에 들어갈 알맞은 개념은?", "다음 뜻을 가진 용어는 무엇인가요?"];
  return {
    unitName: concept[0],
    difficulty: Math.min(5, Math.ceil((GRADE_LEVELS.indexOf(grade) + 1) / 3)) as 1 | 2 | 3 | 4 | 5,
    content: `${prompts[Math.floor(index / 4) % prompts.length]}\n“${concept[1]}”`,
    choices: rotate(concepts.map(([term]) => term), index),
    answer: concept[0],
    explanation: `${concept[0]}은(는) ${concept[1]}을 뜻합니다.`,
  };
}

function englishQuestion(grade: GradeLevel, index: number): Omit<PracticeQuestion, "key" | "gradeLevel" | "subjectId"> {
  const words = ENGLISH_WORDS[grade];
  const word = words[index % words.length]!;
  const variant = Math.floor(index / 4);
  if (variant % 2 === 0) {
    return {
      unitName: "어휘",
      difficulty: Math.min(5, Math.ceil((GRADE_LEVELS.indexOf(grade) + 1) / 3)) as 1 | 2 | 3 | 4 | 5,
      content: variant === 0 ? `'${word[0]}'의 뜻은?` : `다음 뜻에 해당하는 영어 단어는? “${word[1]}”`,
      choices: variant === 0 ? rotate(words.map((item) => item[1]), index) : rotate(words.map((item) => item[0]), index),
      answer: variant === 0 ? word[1] : word[0],
      explanation: `${word[0]}은(는) '${word[1]}'이라는 뜻입니다.`,
    };
  }

  const rank = GRADE_LEVELS.indexOf(grade) + 1;
  const slot = (variant === 1 ? 0 : 4) + (index % 4);
  const basicSubjects = [["I", "am"], ["She", "is"], ["They", "are"], ["We", "are"], ["He", "is"], ["You", "are"], ["It", "is"], ["Tom and I", "are"]] as const;
  const basic = basicSubjects[slot]!;
  const elementary = [
    ["She ___ tennis every Sunday.", "plays", ["plays", "play", "playing", "played"], "3인칭 단수 현재형에는 -s를 붙입니다."],
    ["They ___ English at school.", "study", ["study", "studies", "studying", "studied"], "복수 주어의 현재형에는 동사 원형을 씁니다."],
    ["He ___ TV after dinner.", "watches", ["watches", "watch", "watching", "watched"], "-ch로 끝나는 동사의 3인칭 단수형에는 -es를 붙입니다."],
    ["We ___ books every day.", "read", ["read", "reads", "reading", "reader"], "복수 주어 We 뒤에는 동사 원형 read가 알맞습니다."],
    ["My dog ___ very fast.", "runs", ["runs", "run", "running", "ran"], "3인칭 단수 주어 뒤 현재 동사는 runs입니다."],
    ["I want ___ a scientist.", "to be", ["to be", "being", "am", "been"], "want 뒤에는 to부정사를 씁니다."],
    ["Jane ___ a new pencil.", "has", ["has", "have", "having", "had been"], "3인칭 단수 Jane의 현재형은 has입니다."],
    ["The boys ___ in the pool now.", "are swimming", ["are swimming", "is swimming", "swims", "swam now"], "복수 주어의 현재진행형은 are + -ing입니다."],
  ] as const;
  const middle = [
    ["If it rains, I ___ at home.", "will stay", ["will stay", "stayed", "staying", "stay will"], "조건절이 현재형일 때 주절에는 will을 쓸 수 있습니다."],
    ["I ___ here since 2020.", "have lived", ["have lived", "lived", "am living", "live yesterday"], "since와 함께 과거부터 현재까지를 나타낼 때 현재완료를 씁니다."],
    ["This is the boy ___ helped me.", "who", ["who", "which", "where", "when"], "사람을 선행사로 하는 주격 관계대명사는 who입니다."],
    ["I enjoy ___ books.", "reading", ["reading", "to readed", "read to", "reads"], "enjoy 뒤에는 동명사를 씁니다."],
    ["The window ___ by Tom yesterday.", "was broken", ["was broken", "broke", "is breaking", "has broke"], "과거 시점의 수동은 was/were + 과거분사입니다."],
    ["Unless you hurry, you ___ the bus.", "will miss", ["will miss", "missed", "would missed", "missing"], "unless절이 현재형이면 주절에 미래형을 쓸 수 있습니다."],
    ["She is ___ than her sister.", "taller", ["taller", "more tall", "tallest", "as tall"], "짧은 형용사 tall의 비교급은 taller입니다."],
    ["When I arrived, the train ___.", "had left", ["had left", "has left", "leaves", "will leave"], "도착보다 먼저 일어난 과거 사건은 과거완료로 나타냅니다."],
  ] as const;
  const advanced = [
    ["The book ___ by millions of people since 2000.", "has been read", ["has been read", "has read", "was reading", "reads"], "과거부터 현재까지의 수동은 현재완료 수동태로 나타냅니다."],
    ["Hardly ___ when the phone rang.", "had he arrived", ["had he arrived", "he had arrived", "did he arrived", "has he arrive"], "Hardly가 문두에 오면 과거완료 도치가 일어납니다."],
    ["I wish I ___ harder for the exam.", "had studied", ["had studied", "study", "will study", "have studying"], "과거 사실에 대한 아쉬움은 wish + 과거완료로 나타냅니다."],
    ["The reason ___ he left remains unknown.", "why", ["why", "which", "who", "what"], "reason을 선행사로 하는 관계부사 why가 알맞습니다."],
    ["___ her homework, she went outside.", "Having finished", ["Having finished", "Finished", "To finishing", "Has finish"], "주절보다 먼저 끝난 능동 동작은 완료 분사구문으로 나타냅니다."],
    ["Not only ___ well, but she also danced.", "did she sing", ["did she sing", "she sang", "does she sang", "she did sings"], "Not only가 문두에 오면 조동사와 주어가 도치됩니다."],
    ["It is essential that he ___ present.", "be", ["be", "is", "was", "being"], "당위 표현 뒤 that절에서는 동사 원형을 쓸 수 있습니다."],
    ["The more you read, ___ you become.", "the wiser", ["the wiser", "wiser", "the wisest", "more wise than"], "비례 비교 구문은 the 비교급, the 비교급 형태입니다."],
  ] as const;
  const chosen = rank <= 3 ? null : rank <= 6 ? elementary[slot]! : rank <= 9 ? middle[slot]! : advanced[slot]!;
  const grammar = rank <= 3
    ? { content: `${basic[0]} ___ ready.`, choices: ["am", "is", "are", "be"], answer: basic[1], explanation: `주어 ${basic[0]} 뒤에는 be동사 ${basic[1]}을(를) 씁니다.` }
    : { content: chosen![0], answer: chosen![1], choices: [...chosen![2]], explanation: chosen![3] };
  return { unitName: "문법", difficulty: Math.min(5, Math.ceil(rank / 3)) as 1 | 2 | 3 | 4 | 5, ...grammar, choices: rotate(grammar.choices, index) };
}

export function isGradeLevel(value: string): value is GradeLevel {
  return GRADE_LEVELS.includes(value as GradeLevel);
}

export function generatePracticeSet(gradeLevel: GradeLevel, subjectId: SubjectId): PracticeQuestion[] {
  return Array.from({ length: 16 }, (_, index) => {
    const question = subjectId === "math"
      ? mathQuestion(gradeLevel, index)
      : subjectId === "english"
        ? englishQuestion(gradeLevel, index)
        : conceptQuestion(gradeLevel, subjectId, index);
    return { key: `${gradeLevel}:${subjectId}:${index}`, gradeLevel, subjectId, ...question };
  });
}

export function getPracticeQuestion(questionKey: string) {
  const [grade, subject, rawIndex, ...rest] = questionKey.split(":");
  if (rest.length || !grade || !subject || !rawIndex || !isGradeLevel(grade)) return null;
  if (!["math", "english", "social", "science"].includes(subject)) return null;
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0 || index >= 16) return null;
  return generatePracticeSet(grade, subject as SubjectId)[index] ?? null;
}

export const PRACTICE_QUESTION_COUNT = GRADE_LEVELS.length * 4 * 16;
