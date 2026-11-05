// Vercel 서버리스 함수 (Node.js 환경)
export default async function handler(req, res) {
  // CORS 요청 허용 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  // OPTIONS 프리플라이트 요청 처리
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 1) 쿼리 스트링에서 시도 이름(sido) 추출 (기본값: '서울')
  const sido = req.query.sido || "서울";

  // 2) 환경변수에서 에어코리아 인증키 읽기 (코드에 직접 하드코딩 금지)
  const serviceKey = process.env.AIRKOREA_KEY;
  if (!serviceKey) {
    return res.status(500).json({
      message: "서버 환경변수(AIRKOREA_KEY)가 설정되지 않았습니다. Vercel 또는 .env.local 환경변수를 확인해주세요."
    });
  }

  // 3) 공공데이터포털 요청 URL 구성 (Decoding 키이므로 encodeURIComponent 적용)
  const encodedKey = encodeURIComponent(serviceKey.trim());
  const encodedSido = encodeURIComponent(sido.trim());
  const apiUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodedKey}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodedSido}&ver=1.3`;

  try {
    // 공공데이터포털 API로 HTTP GET 요청
    const apiRes = await fetch(apiUrl);
    const contentType = apiRes.headers.get("content-type") || "";
    const rawText = await apiRes.text();

    // 4) JSON이 아닌 XML 에러 또는 HTML 문서로 응답이 온 경우 검사
    if (contentType.includes("xml") || rawText.trim().startsWith("<")) {
      return res.status(400).json({
        message: "인증키 또는 요청값을 확인해주세요. (공공데이터포털에서 오류 XML이 반환되었습니다)"
      });
    }

    // JSON 데이터 파싱
    let jsonData;
    try {
      jsonData = JSON.parse(rawText);
    } catch (parseError) {
      return res.status(500).json({
        message: "인증키 또는 요청값을 확인해주세요. (응답 데이터를 JSON으로 파싱할 수 없습니다)"
      });
    }

    // 5) 응답 본문 내부 resultCode 확인 (정상 코드는 '00')
    const resultCode = jsonData.response?.header?.resultCode;
    const resultMsg = jsonData.response?.header?.resultMsg;

    if (resultCode && resultCode !== "00") {
      return res.status(400).json({
        message: `공공데이터 API 오류 [${resultCode}]: ${resultMsg || "요청값을 확인해주세요."}`
      });
    }

    // 정상 데이터를 클라이언트로 반환
    return res.status(200).json(jsonData);

  } catch (error) {
    // 네트워크 또는 서버 내부 예외 처리
    return res.status(500).json({
      message: `대기 정보를 불러오는 중 서버 오류가 발생했습니다: ${error.message}`
    });
  }
}

