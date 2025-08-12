const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Spotify API 설정
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

// 폰트와 스타일 설정 (여기서 커스터마이징!)
const STYLE_CONFIG = {
  backgroundColor: '#1a1a1a',
  textColor: '#ffffff',
  accentColor: '#1db954',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  fontSize: {
    title: '16px',
    artist: '14px',
    album: '12px'
  }
};

// Access Token 가져오기
async function getAccessToken() {
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      'grant_type=refresh_token&refresh_token=' + REFRESH_TOKEN,
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('토큰 가져오기 실패:', error.message);
    return null;
  }
}

// 현재 재생 중인 곡 가져오기
async function getCurrentTrack(accessToken) {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    });
    
    if (response.data && response.data.item) {
      return {
        name: response.data.item.name,
        artist: response.data.item.artists[0].name,
        album: response.data.item.album.name,
        image: response.data.item.album.images[0]?.url,
        url: response.data.item.external_urls.spotify,
        isPlaying: response.data.is_playing
      };
    }
    return null;
  } catch (error) {
    console.log('현재 재생 중인 곡이 없음');
    return null;
  }
}

// 최근 재생한 곡 가져오기
async function getRecentTrack(accessToken) {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    });
    
    if (response.data.items && response.data.items.length > 0) {
      const track = response.data.items[0].track;
      return {
        name: track.name,
        artist: track.artists[0].name,
        album: track.album.name,
        image: track.album.images[0]?.url,
        url: track.external_urls.spotify,
        isPlaying: false
      };
    }
    return null;
  } catch (error) {
    console.error('최근 곡 가져오기 실패:', error.message);
    return null;
  }
}

// SVG 위젯 생성
function generateSVG(track) {
  const width = 400;
  const height = 120;
  
  // 기본 상태 (곡이 없을 때)
  if (!track) {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${STYLE_CONFIG.backgroundColor}" rx="8"/>
        <text x="20" y="60" font-family="${STYLE_CONFIG.fontFamily}" font-size="16px" fill="${STYLE_CONFIG.textColor}">
          🎵 Not playing anything
        </text>
      </svg>
    `;
  }

  // 텍스트 길이 제한 함수
  const truncate = (str, length) => str.length > length ? str.substring(0, length) + '...' : str;
  
  const status = track.isPlaying ? '🎵 Now Playing' : '🎵 Recently Played';
  const statusColor = track.isPlaying ? STYLE_CONFIG.accentColor : '#888888';

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .bg { fill: ${STYLE_CONFIG.backgroundColor}; }
          .title { font-family: ${STYLE_CONFIG.fontFamily}; font-size: ${STYLE_CONFIG.fontSize.title}; fill: ${STYLE_CONFIG.textColor}; font-weight: bold; }
          .artist { font-family: ${STYLE_CONFIG.fontFamily}; font-size: ${STYLE_CONFIG.fontSize.artist}; fill: #cccccc; }
          .album { font-family: ${STYLE_CONFIG.fontFamily}; font-size: ${STYLE_CONFIG.fontSize.album}; fill: #888888; }
          .status { font-family: ${STYLE_CONFIG.fontFamily}; font-size: 12px; fill: ${statusColor}; }
          .link { cursor: pointer; }
        </style>
      </defs>
      
      <!-- 배경 -->
      <rect width="100%" height="100%" class="bg" rx="8"/>
      
      <!-- 앨범 커버 (placeholder) -->
      <rect x="15" y="15" width="90" height="90" fill="#333" rx="4"/>
      <text x="60" y="65" text-anchor="middle" font-family="${STYLE_CONFIG.fontFamily}" font-size="30px" fill="#666">🎵</text>
      
      <!-- 곡 정보 -->
      <text x="120" y="25" class="status">${status}</text>
      <text x="120" y="45" class="title">${truncate(track.name, 25)}</text>
      <text x="120" y="65" class="artist">by ${truncate(track.artist, 25)}</text>
      <text x="120" y="85" class="album">${truncate(track.album, 30)}</text>
      
      <!-- 재생 중일 때 애니메이션 -->
      ${track.isPlaying ? `
        <circle cx="370" cy="25" r="4" fill="${STYLE_CONFIG.accentColor}">
          <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
    </svg>
  `;
}

// 메인 함수
async function main() {
  console.log('🎵 Spotify 위젯 업데이트 시작...');
  
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('Access Token을 가져올 수 없습니다.');
    return;
  }
  
  // 현재 재생 중인 곡 먼저 확인
  let track = await getCurrentTrack(accessToken);
  
  // 없으면 최근 재생한 곡 가져오기
  if (!track) {
    track = await getRecentTrack(accessToken);
  }
  
  // SVG 생성
  const svg = generateSVG(track);
  
  // 파일 저장
  await fs.ensureDir('assets');
  await fs.writeFile('assets/spotify-widget.svg', svg);
  
  console.log('✅ Spotify 위젯이 업데이트되었습니다!');
  if (track) {
    console.log(`🎵 ${track.artist} - ${track.name}`);
  }
}

// 스크립트 실행
main().catch(console.error);
