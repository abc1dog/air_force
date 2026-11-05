// Vercel 서버리스 프록시 API 엔드포인트 주소
const API_BASE_URL = "/api/dust";

// 시도 선택 드롭다운 요소 가져오기
const sidoSelect = document.getElementById("sidoSelect");
// 지역 대표 대기 상태 요약 요소 가져오기
const averageSection = document.getElementById("averageSection");
const averageTitle = document.getElementById("averageTitle");
const averageEmoji = document.getElementById("averageEmoji");
const averageGrade = document.getElementById("averageGrade");
const averageValue = document.getElementById("averageValue");
const averageStatus = document.getElementById("averageStatus");
// 측정소별 카드들을 담을 그리드 컨테이너 요소 가져오기
const cardGrid = document.getElementById("cardGrid");
const chartContainer = document.getElementById("chartContainer");
const pm10ChartCanvas = document.getElementById("pm10Chart");
const chartMessage = document.getElementById("chartMessage");
let pm10Chart = null;

// 1~4등급 코드에 따른 라벨 및 CSS 클래스 정의 매핑 객체
const GRADE_MAP = {
  "1": { label: "좋음", emoji: "🔵", color: "#3182ce", className: "grade-1" },
  "2": { label: "보통", emoji: "🟢", color: "#38a169", className: "grade-2" },
  "3": { label: "나쁨", emoji: "🟠", color: "#dd6b20", className: "grade-3" },
  "4": { label: "매우나쁨", emoji: "🔴", color: "#e53e3e", className: "grade-4" }
};

const ENCOURAGEMENT_MESSAGES = {
  "grade-1": [
    "맑은 공기와 함께 기분 좋은 하루 보내세요!",
    "상쾌한 공기예요. 가벼운 산책을 즐겨보세요!",
    "오늘은 바깥 공기가 좋아요. 활기차게 시작해요!"
  ],
  "grade-2": [
    "무난한 공기예요. 편안한 하루 보내세요!",
    "좋은 하루 보내세요. 물도 자주 챙겨 드세요!",
    "가벼운 외출하기 좋은 날이에요!"
  ],
  "grade-3": [
    "외출 시 마스크를 챙기세요. 오늘도 건강하게 보내세요!",
    "외출 시 마스크를 챙기세요. 귀가 후 손 씻기도 잊지 마세요.",
    "외출 시 마스크를 챙기세요. 실내에서 편안히 보내세요!"
  ],
  "grade-4": [
    "외출 시 마스크를 챙기세요. 가능하면 외출을 줄이고 건강을 챙겨요.",
    "외출 시 마스크를 챙기세요. 오늘은 실내에서 편히 쉬어요.",
    "외출 시 마스크를 챙기세요. 불필요한 외출은 줄여 주세요."
  ]
};

function getRandomEncouragement(gradeInfo) {
  const messages = ENCOURAGEMENT_MESSAGES[gradeInfo.className] || ENCOURAGEMENT_MESSAGES["grade-2"];
  return messages[Math.floor(Math.random() * messages.length)];
}

function getAirQualityInfo(average) {
  if (average <= 30) return GRADE_MAP["1"];
  if (average <= 80) return GRADE_MAP["2"];
  if (average <= 150) return GRADE_MAP["3"];
  return GRADE_MAP["4"];
}

function updateAverageSummary(sidoName, gradeInfo, value, message) {
  averageSection.className = `average-section ${gradeInfo.className}`;
  averageTitle.textContent = `${sidoName} 대기 상태`;
  averageEmoji.textContent = gradeInfo.emoji;
  averageGrade.textContent = gradeInfo.label;
  averageValue.textContent = value;
  averageStatus.textContent = message;
}

function showGridMessage(message, isError = false) {
  const messageElement = document.createElement("p");
  messageElement.className = `grid-message${isError ? " is-error" : ""}`;
  messageElement.textContent = message;
  cardGrid.replaceChildren(messageElement);
}

function clearPm10Chart(message) {
  if (pm10Chart) {
    pm10Chart.destroy();
    pm10Chart = null;
  }
  pm10ChartCanvas.hidden = true;
  chartMessage.hidden = false;
  chartMessage.textContent = message;
  chartContainer.style.height = "180px";
}

function renderPm10Chart(items) {
  const rankedStations = items
    .map((item) => {
      const rawValue = item.pm10Value;
      if (rawValue === null || rawValue === undefined || String(rawValue).trim() === "" || String(rawValue).trim() === "-") {
        return null;
      }

      const value = Number(rawValue);
      if (!Number.isFinite(value)) return null;

      const gradeInfo = getGradeInfo(item.pm10Grade);
      return {
        stationName: item.stationName || "측정소",
        value,
        color: gradeInfo.color || "#a0aec0"
      };
    })
    .filter(Boolean)
    .sort((first, second) => second.value - first.value)
    .slice(0, 10);

  clearPm10Chart(rankedStations.length ? "" : "표시할 미세먼지 측정값이 없습니다.");
  if (!rankedStations.length) return;

  chartMessage.hidden = true;
  pm10ChartCanvas.hidden = false;
  chartContainer.style.height = `${Math.max(180, rankedStations.length * 38 + 48)}px`;
  pm10Chart = new Chart(pm10ChartCanvas, {
    type: "bar",
    data: {
      labels: rankedStations.map((station) => station.stationName),
      datasets: [{
        label: "PM10",
        data: rankedStations.map((station) => station.value),
        backgroundColor: rankedStations.map((station) => station.color),
        borderColor: rankedStations.map((station) => station.color),
        borderWidth: 1,
        borderRadius: 3,
        barThickness: 20
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.x} ㎍/㎥`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "PM10 (㎍/㎥)" },
          ticks: { precision: 0 }
        },
        y: {
          grid: { display: false },
          ticks: { autoSkip: false }
        }
      }
    }
  });
}

// 미세먼지 및 초미세먼지 수치 포맷팅 함수 ("-" 결측치 처리)
function formatMeasureValue(value) {
  // 수치 값이 없거나 "-" 기호이거나 숫자로 변환 불가능한 경우 처리
  if (!value || value.trim() === "-" || isNaN(Number(value))) {
    return "측정 안 됨";
  }
  // 유효한 수치인 경우 단위(㎍/㎥)와 함께 반환
  return `${value} ㎍/㎥`;
}

// 등급(pm10Grade) 값에 따른 스타일 및 라벨 정보 반환 함수
function getGradeInfo(gradeCode) {
  // 등급 코드가 유효하게 존재하는 경우 매핑 정보 반환
  if (gradeCode && GRADE_MAP[gradeCode]) {
    return GRADE_MAP[gradeCode];
  }
  // 등급 값이 비어있거나 없는 경우 회색 테마 정보 반환
  return { label: "등급 없음", emoji: "⚪", className: "grade-unknown" };
}

function formatDataTime(dataTime) {
  const match = dataTime && dataTime.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):\d{2}/);
  if (!match) return "측정 시각 정보 없음";
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일 ${Number(match[4])}시 기준`;
}

// 선택된 시도의 실시간 대기오염 데이터를 서버리스 함수(/api/dust)를 통해 요청하는 비동기 함수
async function fetchAirQuality(sidoName) {
  // 데이터 로딩 시작 시 상태 문구 갱신
  averageSection.className = "average-section is-loading";
  averageTitle.textContent = `${sidoName} 대기 상태`;
  averageEmoji.textContent = "⚪";
  averageGrade.textContent = "불러오는 중...";
  averageValue.textContent = "";
  averageStatus.textContent = "측정 데이터를 확인하고 있습니다.";
  showGridMessage("불러오는 중...");
  clearPm10Chart("불러오는 중...");

  // Vercel 서버리스 프록시 API 호출 URL 생성 (/api/dust?sido=시도이름)
  const requestUrl = `${API_BASE_URL}?sido=${encodeURIComponent(sidoName)}`;

  try {
    // 자체 서버리스 엔드포인트로 비동기 GET 요청 전송
    const response = await fetch(requestUrl);
    // 응답 텍스트를 JSON 객체로 파싱
    const jsonResult = await response.json();

    // 서버리스 함수에서 에러 응답(message)을 반환했거나 상태 코드가 비정상인 경우
    if (!response.ok || jsonResult.message) {
      throw new Error(jsonResult.message || `네트워크 오류 (상태 코드: ${response.status})`);
    }

    // 응답 본문 안에서 측정소 목록 배열 추출
    const items = jsonResult.response?.body?.items || [];

    // 반환된 측정소 데이터가 없는 경우의 화면 처리
    if (items.length === 0) {
      updateAverageSummary(sidoName, { label: "정보 없음", emoji: "⚪", className: "grade-unknown" }, "측정 안 됨", "현재 대기 정보를 확인할 수 없습니다.");
      showGridMessage("조회된 측정소 데이터가 없습니다.");
      clearPm10Chart("표시할 미세먼지 측정값이 없습니다.");
      return;
    }

    // 측정소 목록 렌더링 및 평균 계산 함수 호출
    renderData(sidoName, items);

  } catch (error) {
    // 에러 발생 시 콘솔 로그 출력 및 UI에 에러 문구 안내
    console.error("데이터 조회 실패:", error);
    updateAverageSummary(sidoName, { label: "조회 실패", emoji: "⚪", className: "grade-unknown" }, "!", error.message);
    showGridMessage(error.message, true);
    clearPm10Chart(error.message);
  }
}

// 데이터를 기반으로 평균 수치를 계산하고 측정소 카드들을 화면에 그리는 함수
function renderData(sidoName, items) {
  // 상단 평균 섹션 제목에 선택한 시도 이름 반영
  averageTitle.textContent = `${sidoName} 평균 미세먼지`;

  // 기존 카드 목록 초기화
  cardGrid.innerHTML = "";
  renderPm10Chart(items);

  // 유효한 미세먼지 수치 합산용 변수
  let totalPm10 = 0;
  // 유효한 수치를 가진 측정소 개수 카운트 변수
  let validPm10Count = 0;

  // 측정소 목록을 하나씩 순회하며 카드 생성
  items.forEach((item) => {
    // 측정소 이름 추출 (기본값 설정)
    const stationName = item.stationName || "측정소";
    // 미세먼지 수치 값 추출
    const pm10Value = item.pm10Value;
    // 초미세먼지 수치 값 추출
    const pm25Value = item.pm25Value;
    // 측정 일시 추출
    const dataTime = item.dataTime || "측정 시각 정보 없음";
    // 등급 코드 추출
    const pm10Grade = item.pm10Grade;

    // 미세먼지 수치가 "-"가 아니고 정상적인 숫자인 경우만 평균 계산에 포함
    if (pm10Value && pm10Value.trim() !== "-" && !isNaN(Number(pm10Value))) {
      totalPm10 += Number(pm10Value);
      validPm10Count++;
    }

    // 등급 코드에 따른 스타일 클래스와 라벨 획득
    const gradeInfo = getGradeInfo(pm10Grade);

    // 카드 요소 생성
    const cardElement = document.createElement("div");
    // 등급에 맞는 CSS 클래스 적용 (1 파랑, 2 초록, 3 주황, 4 빨강, 비어있으면 회색)
    cardElement.className = `card ${gradeInfo.className}`;

    // 카드 내부 HTML 구조 작성
    cardElement.innerHTML = `
      <div class="card-header">
        <span class="card-station">${stationName}</span>
        <span class="badge">${gradeInfo.label}</span>
      </div>
      <div class="card-body">
        <div class="data-row">
          <span>미세먼지 (PM10)</span>
          <span class="data-value">${formatMeasureValue(pm10Value)}</span>
        </div>
        <div class="data-row">
          <span>초미세먼지 (PM2.5)</span>
          <span class="data-value">${formatMeasureValue(pm25Value)}</span>
        </div>
      </div>
      <div class="card-time">${formatDataTime(dataTime)}</div>
    `;

    // 생성된 카드를 그리드 컨테이너에 추가
    cardGrid.appendChild(cardElement);
  });

  // 유효한 측정 수치가 하나 이상 있는 경우 평균값 표시
  if (validPm10Count > 0) {
    // 평균 계산 후 반올림 처리
    const average = Math.round(totalPm10 / validPm10Count);
    // 큰 숫자로 평균 미세먼지 수치 표시
    averageValue.textContent = `${average} ㎍/㎥`;

    const gradeInfo = getAirQualityInfo(average);
    const message = getRandomEncouragement(gradeInfo);
    updateAverageSummary(sidoName, gradeInfo, `${average} ㎍/㎥`, message);
  } else {
    // 모든 측정소의 값이 "-"이거나 유효 데이터가 없는 경우
    updateAverageSummary(sidoName, { label: "정보 없음", emoji: "⚪", className: "grade-unknown" }, "측정 안 됨", "유효하게 측정된 미세먼지 데이터가 없습니다.");
  }
}

// 드롭다운에서 시도를 변경했을 때 실행되는 이벤트 리스너 등록
sidoSelect.addEventListener("change", (event) => {
  // 선택된 시도 값으로 데이터 재조회
  fetchAirQuality(event.target.value);
});

// 페이지가 처음 열렸을 때 기본 선택된 지역(서울)으로 데이터 자동 조회
fetchAirQuality(sidoSelect.value);
