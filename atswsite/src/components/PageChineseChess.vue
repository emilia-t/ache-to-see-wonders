<script setup lang="ts">
// The relative position of this file: src/components/PageChineseChess.vue
// CC1
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import Tool from '@/class/Tool';
import type Notification from '@/interface/Notification';
import type Coord3D from '@/interface/Coord3D';
import type PieceSyncData from '@/interface/PieceSyncData';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sceneConfig, piecesConfig, cameraConfig, rendererConfig, lightConfig ,type PieceNameKeys} from '@/config/chineseChessConfig.ts';
import { CHINESE_CHESS_SERVER_URL } from '@/config/apiConfig.ts';
import { useGameSettingStore } from '@/stores/store'
import type CampData from '@/interface/CampData';
import type LogConfig from '@/interface/LogConfig';
import type InstructObject from '@/interface/InstructObject';
import ChineseChessInstruct from '@/class/ChineseChessInstruct';
import ViewUserLayer from './ViewUserLayer.vue';
import ViewHeart from '@/components/ViewHeart.vue';
import PartCC1Check from './PartCC1Check.vue';
import PartCC1Loading from './PartCC1Loading.vue';
import PartCC1StartMenu from './PartCC1StartMenu.vue';
import ViewCC1Menu from './ViewCC1Menu.vue';
import ViewCC1GiveUp from './ViewCC1GiveUp.vue';
import ViewCC1GiveUpConfirm from './ViewCC1GiveUpConfirm.vue';
import ViewCC1GiveUpResult from './ViewCC1GiveUpResult.vue';
import ViewCC1ResetChess from './ViewCC1ResetChess.vue';
import ViewCC1ResetChessResult from './ViewCC1ResetChessResult.vue';
import ViewCC1Notifications from './ViewCC1Notifications.vue';
import ViewCC1DebugInfo from './ViewCC1DebugInfo.vue';

// ==============================
// Three.js 对象变量
// ==============================
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let directionalLight1: THREE.DirectionalLight;
let directionalLight2: THREE.DirectionalLight;
let fillLight: THREE.DirectionalLight;
let ambientLight: THREE.AmbientLight;
let coffeeTable: THREE.Group; // 咖啡桌模型组
let gGraniteSlate: THREE.Group; // 咖啡桌模型组
let chessBoard: THREE.Group; // 棋盘模型组
let chessPieces: THREE.Group; // 棋子模型组
let panoramaCube: THREE.Mesh; // 全景立方体
let centerGridHelper: THREE.GridHelper; // 参考网格
let centerAxesHelper: THREE.AxesHelper; // 参考坐标轴
let playerHeadBox_1: THREE.Group; // 玩家头部
let playerHeadBox_2: THREE.Group; // 玩家头部

// ==============================
// 第一人称视角控制相关变量
// ==============================
let   isPointerLocked = false;
let   canJump = false;
let   prevTime = performance.now();
let   pitch = 0;// 俯仰角（上下看）
let   yaw = 0;// 偏航角（左右看）
let   rotationSpeed = 0.002;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = {forward: false,backward: false,left: false,right: false};
const gameSettingStore = useGameSettingStore();// 使用游戏设置 store

// ==============================
// 第一人称棋子操作相关变量
// ==============================
let raycaster: THREE.Raycaster;
let isPicking = false;
let pickedPiece: THREE.Object3D | null = null;
let originalMaterial: THREE.Material | THREE.Material[] | null = null;
let transparentMaterial: THREE.MeshLambertMaterial;

// ==============================
// 棋子状态管理
// ==============================
const chessPiecesState = ref<{ [key: string]: { // 拾起
  isPicked: boolean; 
  pickedBy: string; 
  position: { x: number; y: number; z: number };
  lastUpdate: number;
} }>({});
const chessPiecesMoveHistory = ref<{ [key: string]: { // 走子
  lastPickUpPosition: Coord3D | null;
  lastPickUpTime: number;
  lastPickUpBy: string;
} }>({});

// ==============================
// 棋子移动轨迹
// ==============================
let moveTrajectory: Coord3D[] = [];
let lastMoveBroadcastTime = 0;

// ==============================
// 加载状态管理
// ==============================
const loadingState = ref({
  isLoading: true,
  progress: 0,
  statusText: '正在初始化场景...',
  loadedResources: 0,
  totalResources: 0
});

// ==============================
// 子组件引用
// ==============================
const sceneRef = ref<HTMLDivElement>();
const heartRef = ref<InstanceType<typeof ViewHeart> | null>(null);
const startMenuRef = ref<InstanceType<typeof PartCC1StartMenu> | null>(null);
const giveUpConfirmRef = ref<InstanceType<typeof ViewCC1GiveUpConfirm> | null>(null);

// ==============================
// 杂项变量和常量
// ==============================
const gameTick = 50;//ms
const selectedCampC1 =  ref('');
const giveUpStateC1 = ref(false);
const giveUpCdTimeC1 = 5;//second
const giveUpConveyorC1 = ref('');//last fail user (name + & + email)
const resetChessCountC1 = ref(0);
const resetChessConveyorC1 = ref('');//last reset user (name + & + email)
const pieceTrajectoriesC1 = ref<{[key: string]:{points: Coord3D[];startTime: number;duration: number;currentIndex: number;}}>({});// 棋子运动轨迹插值
const campDataC1 = ref<CampData>({red: {email: '',name: '',id: 0},black: {email: '',name: '',id: 0}});// 阵营数据
const pieceOriginalMaterials = new Map<string, THREE.Material | THREE.Material[]>(); // 用于保存棋子原始材质
const piecesPendingData = ref<any>(null);// 待同步的棋子数据
const notificationArr = ref<Notification[]>([]);// 通知管理
const playerNameTags = new Map<string, CSS2DObject>();// 玩家名字标签管理
const playersDataHeadModel = ref<{ [key: string]: {// 玩家头部状态管理
  position: Coord3D;
  targetPosition: Coord3D; 
  pitch: number;
  yaw: number;
  targetPitch: number; 
  targetYaw: number;  
  name: string;
  lastUpdate: number;
  camp: string;
}}>({});
const debugInfoC1 = ref({
  cameraPosition: { x: 0, y: 0, z: 0 },
  intersectionPoint: { x: 0, y: 0, z: 0 },
  hasIntersection: false
});
let   enabledDebug = false;
let   labelRenderer: any = null;
let   headBroadcastInterval: number | null = null;// 头部数据广播定时器
let   notificationIdCounter = 0;

// ==============================
// 与服务器通信相关的方面
// ==============================
const ccInstruct = new ChineseChessInstruct(CHINESE_CHESS_SERVER_URL);
ccInstruct.onLog = (message:string,type:'tip'|'warn'|'error',data?:any):LogConfig=>{
  const logConfig = {
    code:0,
    time:Tool.getFormatTime(),
    text:message,
    from:'ChineseChessInstruct',
    type:type,
    data:data
  }
  return logConfig;
};
ccInstruct.onOpen = (ev: Event):void=>{
  console.log("服务器已连接");
  // 获取公钥
  ccInstruct.getPublickey();
  // 自动登录
  const localStorageUserId = localStorage.getItem('user_id');
  const localStorageUserToken = localStorage.getItem('user_token');
  if(localStorageUserId && localStorageUserToken){
    ccInstruct.getTokenLogin(Number(localStorageUserId),localStorageUserToken);
  }
};

ccInstruct.onLogin = ():void=>{
  ccInstruct.getCampData();
  ccInstruct.getSyncChessPieces();
  ccInstruct.getRbHeadPositionPitchYaw();
};

ccInstruct.onLogout = ():void=>{
  return
};

ccInstruct.onClose = (ev: Event):void=>{
  console.log("服务器断开连接",ev);
};
ccInstruct.onError = (ev: Event):void=>{
  console.log("服务器连接失败",ev);
};
ccInstruct.onMessage = (instructObj: InstructObject):void=>{
  handleMessage(instructObj);
};

/**
 * 处理服务器指令
 */
const handleMessage = (instructObj: InstructObject) => {
  const { type, class: class_, conveyor, data } = instructObj;
  //console.log(instructObj)
  switch (type) {
    case 'broadcast':{
      switch (class_) {
        case 'pick_up_chess':
          handleBroadcastPickUpChess(conveyor, data);
          break;
        case 'pick_down_chess':
          handleBroadcastPickDownChess(conveyor, data);
          break;
        case 'moving_chess':
          handleBroadcastMovingChess(conveyor, data);
          break;
        case 'head_position_pitch_yaw':
          handleBroadcastHeadPositionPitchYaw(conveyor, data);
          break;
        case 'reset_all_chess_pieces':
          handleBroadcastResetAllChessPieces(conveyor, data);
          break;
        case 'give_up':
          handleBroadcastGiveUp(conveyor, data);
          break;
        case 'user_left_game':
          handleBroadcastUserLeftGame(conveyor, data);
          break;
        case 'user_join_game':
          handleBroadcastUserJoinGame(conveyor, data);
          break;
      }
      break;
    }
    case 'rb_head_position_pitch_yaw':{
      handleRbHeadPositionPitchYaw(data)
      break;
    }
    case 'sync_chess_pieces':{
      handleSyncChessPieces(data);
      break;
    }
    case 'camp_data':{
      handleCampData(data);
      break;
    }
    case 'heart_tk':{
      handleHeartTk();
      break;
    }
    case 'select_camp_red':{
      selectedCampC1.value = 'red';
      break;
    }
    case 'select_camp_black':{
      selectedCampC1.value = 'black';
      break;
    }
  }
};

/**
 * 处理阵营数据变化
 */
const handleCampData = (data: any) => {
  campDataC1.value = {
    red: {
      id: data.red.id,
      name: data.red.name,
      email: data.red.email
    },
    black: {
      id: data.black.id,
      name: data.black.name,
      email: data.black.email
    }
  };
  
  // 更新头部模型可见性
  updatePlayerHeadVisibility();
};

/**
 * 服务器返回玩家加入和退出游戏事件处理
 */

const handleBroadcastUserJoinGame = (conveyor: string, data: any) => {
  const userName = conveyor.split('&')[0]; // 从conveyor中提取用户名
  const userEmail = conveyor.split('&')[1]; // 从conveyor中提取用户名
  const notification : Notification = {
    id: notificationIdCounter++,
    timestamp: Date.now(),
    content: {
      type: 'join',
      name: userName,
      email: userEmail
    }
  };
  notificationArr.value.push(notification);
  let ID = notification.id
  setTimeout(() => {
    const index = notificationArr.value.findIndex(notif => notif.id === ID);
    if (index !== -1) {
      notificationArr.value.splice(index, 1);
    }
  }, 5000);

  updatePlayerHeadVisibility();// 更新头部模型可见性
};
const handleBroadcastUserLeftGame = (conveyor: string, data: any) => {
  const userName = conveyor.split('&')[0]; // 从conveyor中提取用户名
  const userEmail = conveyor.split('&')[1]; // 从conveyor中提取用户名
  
  // 从玩家头部数据中移除该玩家
  if (playersDataHeadModel.value[conveyor]) {
    delete playersDataHeadModel.value[conveyor];
  }
  
  // 移除玩家的名字标签
  removePlayerHead(conveyor);
  
  // 显示离开通知
  const notification : Notification = {
    id: notificationIdCounter++,
    timestamp: Date.now(),
    content: {
      type: 'left',
      name: userName,
      email: userEmail
    }
  };
  
  notificationArr.value.push(notification);
  let ID = notification.id
  // 5秒后自动移除通知
  setTimeout(() => {
    const index = notificationArr.value.findIndex(notif => notif.id === ID);
    if (index !== -1) {
      notificationArr.value.splice(index, 1);
    }
  }, 5000);
    
  updatePlayerHeadVisibility();// 更新头部模型可见性
};

/**
 * 服务器返回投降事件
 */
const handleBroadcastGiveUp = (conveyor: string, data: any) =>{
  giveUpStateC1.value=true;
  giveUpConveyorC1.value=conveyor;
  setTimeout(
    ()=>{
      giveUpStateC1.value=false;
    },
    giveUpCdTimeC1*1000
  );
};

/**
 * 服务器返回点赞事件处理
 */
const handleHeartTk = () => {
  if (heartRef.value) {
    heartRef.value.setLiked(true);
  }
}

/**
 * 处理点赞事件
 */
const handleHeart3=()=>{
  ccInstruct.heart3();
};

/**
 * 处理广播的重置所有棋子指令
 */
const handleBroadcastResetAllChessPieces = (conveyor: string, data: any) => {
  // 清除所有移动箭头
  removeAllArrowGroups();
  
  // 重置所有棋子状态（原有逻辑）
  Object.keys(chessPiecesState.value).forEach(pieceName => {
    chessPiecesState.value[pieceName] = {
      isPicked: false,
      pickedBy: '',
      position: { x: 0, y: 0, z: 0 },
      lastUpdate: Date.now()
    };
    
    // 在场景中重置棋子位置和状态
    const piece = chessPieces?.getObjectByName(pieceName);
    if (piece) {
      piece.position.set(0, 0, 0);
      restorePieceState(piece);
    }
    
    // 清除移动历史
    if (chessPiecesMoveHistory.value[pieceName]) {
      chessPiecesMoveHistory.value[pieceName].lastPickUpPosition = null;
    }
  });
  
  // 如果当前正在拾起棋子，也重置拾起状态
  if (isPicking && pickedPiece) {
    resetPickingState();
  }
  
  resetChessCountC1.value += 1;
  resetChessConveyorC1.value = conveyor;
  giveUpConveyorC1.value = '';
};

/**
 * 处理同步棋子状态指令
 */
const handleSyncChessPieces = (data: any) => {
  const { pieces } = data;
  
  if (!pieces || !Array.isArray(pieces)) {
    console.error('同步棋子数据格式错误');
    return;
  }

  // 检查棋子组是否已创建
  if (!chessPieces) {
    piecesPendingData.value = data;
    return;
  }

  // 检查棋子是否全部加载完成
  const allPiecesLoaded = pieces.every(pieceData => {
    return chessPieces.getObjectByName(pieceData.piece_name);
  });

  if (!allPiecesLoaded) {
    piecesPendingData.value = data;
    return;
  }

  handleSyncChessPiecesP(data);
};

/**
 * 应用同步数据
 */
const handleSyncChessPiecesP = (data: any) => {
  const { pieces } = data;
  
  pieces.forEach((pieceData: PieceSyncData) => {
    const { piece_name, position, is_picked, picked_by } = pieceData;
    
    // 更新棋子状态管理
    chessPiecesState.value[piece_name] = {
      isPicked: is_picked,
      pickedBy: picked_by,
      position: position,
      lastUpdate: Date.now()
    };
    
    // 在场景中更新棋子位置和状态
    const piece = chessPieces.getObjectByName(piece_name);
    
    if (piece) {
      piece.position.set(position.x, position.y, position.z);
      
      if (is_picked && picked_by) {
        setPieceAsPickedByOther(piece);
      } else {
        restorePieceState(piece);
      }
    }
  });
  
  console.log('棋子状态同步完成');
  piecesPendingData.value = null;
};

/**
 * 处理广播的拾起棋子指令
 */
const handleBroadcastPickUpChess = (conveyor: string, data: any) => {
  const { piece_name, position } = data;
  // 记录拾起位置
  if (!chessPiecesMoveHistory.value[piece_name]) {
    chessPiecesMoveHistory.value[piece_name] = {
      lastPickUpPosition: null,
      lastPickUpTime: 0,
      lastPickUpBy: ''
    };
  }
  
  chessPiecesMoveHistory.value[piece_name].lastPickUpPosition = { ...position };
  chessPiecesMoveHistory.value[piece_name].lastPickUpTime = Date.now();
  chessPiecesMoveHistory.value[piece_name].lastPickUpBy = conveyor;
  
  // 更新棋子状态（原有逻辑）
  chessPiecesState.value[piece_name] = {
    isPicked: true,
    pickedBy: conveyor,
    position: position,
    lastUpdate: Date.now()
  };
  
  // 在场景中更新棋子状态和位置
  const piece = chessPieces?.getObjectByName(piece_name);
  if (piece) {
    piece.position.set(position.x, position.y, position.z);
    setPieceAsPickedByOther(piece);
  }
  console.log(`玩家 ${conveyor} 拾起了棋子 ${piece_name}`);
};

/**
 * 处理广播的放置棋子指令
 */
const handleBroadcastPickDownChess = (conveyor: string, data: any) => {
  const { piece_name, position } = data;
  
  // 检查是否有拾起记录并创建箭头
  const moveHistory = chessPiecesMoveHistory.value[piece_name];
  if (moveHistory && moveHistory.lastPickUpPosition && moveHistory.lastPickUpBy === conveyor) {
    const startPos = moveHistory.lastPickUpPosition;
    const endPos = position;
    
    // 确定玩家阵营
    let playerCamp = 'unknown';
    if (playersDataHeadModel.value[conveyor]) {
      playerCamp = playersDataHeadModel.value[conveyor].camp;
    } else {
      // 通过对比阵营数据确定
      const redKey = `${campDataC1.value.red.name}&${campDataC1.value.red.email}`;
      const blackKey = `${campDataC1.value.black.name}&${campDataC1.value.black.email}`;
      
      if (conveyor === redKey) {
        playerCamp = 'red';
      } else if (conveyor === blackKey) {
        playerCamp = 'black';
      }
    }
    // 清除之前的箭头
    removeAllArrowGroups();
    // 添加移动箭头
    addMoveArrow(startPos, endPos, playerCamp, conveyor, piece_name);
    // 清除拾起记录
    moveHistory.lastPickUpPosition = null;
  }
  
  // 更新棋子状态（原有逻辑）
  chessPiecesState.value[piece_name] = {
    isPicked: false,
    pickedBy: '',
    position: position,
    lastUpdate: Date.now()
  };
  
  // 在场景中更新棋子状态和位置
  const piece = chessPieces?.getObjectByName(piece_name);
  if (piece) {
    restorePieceState(piece);
    piece.position.set(position.x, position.y, position.z);
  }
  
  console.log(`玩家 ${conveyor} 放置了棋子 ${piece_name}`);
};

/**
 * 处理广播的玩家头部位置和旋转数据
 */
const handleBroadcastHeadPositionPitchYaw = (conveyor: string, data: any) => {
  const { position, pitch, yaw, camp } = data;
  
  // 更新其他玩家数据
  if (!playersDataHeadModel.value[conveyor]) {
    playersDataHeadModel.value[conveyor] = {
      position: position,
      targetPosition: position,
      pitch: pitch,
      yaw: yaw,
      targetPitch: pitch,
      targetYaw: yaw,
      name: conveyor.split('&')[0],
      lastUpdate: Date.now(),
      camp: camp
    };
  } else {
    // 只更新目标位置和旋转，不直接更新当前位置
    playersDataHeadModel.value[conveyor].targetPosition = position;
    playersDataHeadModel.value[conveyor].targetPitch = pitch;
    playersDataHeadModel.value[conveyor].targetYaw = yaw;
    playersDataHeadModel.value[conveyor].lastUpdate = Date.now();
    playersDataHeadModel.value[conveyor].camp = camp;
  }
};

const handleRbHeadPositionPitchYaw = (data: any) => {
  const { red, black } = data;
  if (!playersDataHeadModel.value[red.conveyor]) {
    playersDataHeadModel.value[red.conveyor] = {
      position: red.position,
      targetPosition: red.position,
      pitch: red.pitch,
      yaw: red.yaw,
      targetPitch: red.pitch,
      targetYaw: red.yaw,
      name: red.conveyor.split('&')[0],
      lastUpdate: Date.now(),
      camp: 'red'
    };
  }
  if (!playersDataHeadModel.value[black.conveyor]) {
    playersDataHeadModel.value[black.conveyor] = {
      position: black.position,
      targetPosition: black.position,
      pitch: black.pitch,
      yaw: black.yaw,
      targetPitch: black.pitch,
      targetYaw: black.yaw,
      name: black.conveyor.split('&')[0],
      lastUpdate: Date.now(),
      camp: 'black'
    };
  }
};

/**
 * 处理广播的移动中棋子指令
 */
const handleBroadcastMovingChess = (conveyor: string, data: any) => {
  const { piece_name, trajectory } = data;
  
  if (trajectory && trajectory.length > 0) {
    const latestPosition = trajectory[trajectory.length - 1];
    
    // 更新棋子状态
    chessPiecesState.value[piece_name] = {
      isPicked: true,
      pickedBy: conveyor,
      position: latestPosition,
      lastUpdate: Date.now()
    };
    
    // 在场景中更新棋子位置
    const piece = chessPieces?.getObjectByName(piece_name);
    if (piece && piece !== pickedPiece) {
      // 获取棋子当前位置
      const currentPosition = {
        x: piece.position.x,
        y: piece.position.y,
        z: piece.position.z
      };
      
      // 如果轨迹点数量足够，使用轨迹插值
      if (trajectory.length >= 2) {
        // 创建平滑的轨迹：从当前位置开始，连接到接收到的轨迹
        const smoothTrajectory = [currentPosition, ...trajectory];
        
        pieceTrajectoriesC1.value[piece_name] = {
          points: smoothTrajectory,
          startTime: Date.now(),
          duration: gameTick * (smoothTrajectory.length - 1), // 总持续时间
          currentIndex: 0
        };
      } else {
        // 只有一个点，直接设置位置
        piece.position.set(latestPosition.x, latestPosition.y, latestPosition.z);
      }
    }
  }
};


// ==============================
// 游戏操作或模型创建等方面函数
// ==============================
/**
 * 更新调试信息
 */
const updateDebugInfo = () => {
  if (!camera || !scene) return;
  
  // 更新相机位置
  debugInfoC1.value.cameraPosition = {
    x: Number(camera.position.x.toFixed(3)),
    y: Number(camera.position.y.toFixed(3)),
    z: Number(camera.position.z.toFixed(3))
  };
  
  // 计算视线交点
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  
  // 使用与棋子放置相同的过滤条件
  const intersectableObjects = scene.children.filter(createIntersectableFilter());
  const intersects = raycaster.intersectObjects(intersectableObjects, true);
  
  if (intersects.length > 0) {
    const intersect = intersects[0];
    debugInfoC1.value.intersectionPoint = {
      x: Number(intersect.point.x.toFixed(3)),
      y: Number(intersect.point.y.toFixed(3)),
      z: Number(intersect.point.z.toFixed(3))
    };
    debugInfoC1.value.hasIntersection = true;
  } else {
    debugInfoC1.value.hasIntersection = false;
    // 如果没有交点，可以显示射线方向上的某个点，或者重置为0
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const targetPoint = camera.position.clone().add(direction.multiplyScalar(10)); // 10单位距离的点
    
    debugInfoC1.value.intersectionPoint = {
      x: Number(targetPoint.x.toFixed(3)),
      y: Number(targetPoint.y.toFixed(3)),
      z: Number(targetPoint.z.toFixed(3))
    };
  }
};

/** 
 *  计算总资源数量
 */
const calculateTotalResources = () => {
  // 全景图6个面 + 花岗岩石板 + 棋盘 + 棋子数量
  const total = 6 + 1 + 1 + piecesConfig.length;
  loadingState.value.totalResources = total;
  return total;
};

/**
 * 平滑插值更新函数
 */ 
const smoothUpdatePlayerHeads = (delta: number) => {
  const lerpFactor = 0.2; // 插值因子，可调整平滑程度
  const rotationLerpFactor = 0.1; // 旋转插值因子
  
  Object.keys(playersDataHeadModel.value).forEach(conveyor => {
    const playerData = playersDataHeadModel.value[conveyor];
    
    // 位置插值（线性插值）
    playerData.position.x += (playerData.targetPosition.x - playerData.position.x) * lerpFactor;
    playerData.position.y += (playerData.targetPosition.y - playerData.position.y) * lerpFactor;
    playerData.position.z += (playerData.targetPosition.z - playerData.position.z) * lerpFactor;
    
    // 旋转插值（角度插值）
    playerData.pitch += (playerData.targetPitch - playerData.pitch) * rotationLerpFactor;
    playerData.yaw += (playerData.targetYaw - playerData.yaw) * rotationLerpFactor;
    
    // 更新模型
    updatePlayerHeadModel(conveyor, playerData.position, playerData.pitch, playerData.yaw, playerData.camp);
  });
};

/**
 * 更新玩家头部模型可见性
 */
const updatePlayerHeadVisibility = () => {
  const redName = campDataC1.value.red.name;
  const blackName = campDataC1.value.black.name;
  if (playerHeadBox_1) {
    // 红方头部模型：如果有红方玩家且不是当前玩家，则显示
    let visible_1 = redName !== '' && selectedCampC1.value !== 'red'
    playerHeadBox_1.visible = visible_1;
    playerHeadBox_1.traverse((child) => {
        child.visible = visible_1;
    });
  }
  if (playerHeadBox_2) {
    // 黑方头部模型：如果有黑方玩家且不是当前玩家，则显示
    let visible_2 = blackName !== '' && selectedCampC1.value !== 'black';
    playerHeadBox_2.visible = visible_2;
    playerHeadBox_2.traverse((child) => {
        child.visible = visible_2;
    });
  }
};

/**
 * 更新玩家头部模型位置和旋转
 */
const updatePlayerHeadModel = (conveyor: string, position: Coord3D, pitch: number, yaw: number, camp: string) => {
  // 如果是当前玩家自己的阵营，不渲染对应的头部模型
  if (camp === selectedCampC1.value) {
    return;
  }
  
  let headModel: THREE.Group | undefined;
  
  // 根据 camp 分配不同的头部模型
  if (camp === 'red') { 
    headModel = playerHeadBox_1;
  } else if (camp === 'black') {
    headModel = playerHeadBox_2;
  }
  
  if (headModel) {
    // 确保模型可见
    headModel.visible = true;
    
    // 获取对应的偏移值
    let offset: { x: number; y: number; z: number };
    if (camp === 'red') {
      offset = sceneConfig.playerHeadBoxOffset.rad_1;
    } else {
      offset = sceneConfig.playerHeadBoxOffset.black_2;
    }
    
    // 更新位置，减去模型加载初期的偏移值
    headModel.position.set(
      position.x - offset.x,
      position.y - offset.y - (sceneConfig.altitude.V_Player_head_box_1 / 2), 
      position.z - offset.z
    );
    
    // 更新旋转
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    headModel.setRotationFromQuaternion(quaternion);
    
    // 更新名字标签
    updatePlayerNameTag(conveyor, position, playersDataHeadModel.value[conveyor]?.name || conveyor);
  }
};

/**
 * 创建玩家名字标签
 */
const createPlayerNameTag = (playerId: string, position: Coord3D, playerName: string) => {
  if(playerName === ''){
    return
  }
  // 创建名字标签的HTML元素
  const nameTagDiv = document.createElement('div');
  nameTagDiv.className = 'player-name-tag';
  nameTagDiv.textContent = playerName;
  nameTagDiv.style.color = 'white';
  nameTagDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  nameTagDiv.style.padding = '4px 8px';
  nameTagDiv.style.borderRadius = '4px';
  nameTagDiv.style.fontSize = '15px';
  nameTagDiv.style.fontFamily = 'Arial, sans-serif';
  nameTagDiv.style.pointerEvents = 'none';
  nameTagDiv.style.whiteSpace = 'nowrap';
  nameTagDiv.style.textAlign = 'center';
  nameTagDiv.style.backdropFilter = 'blur(2px)';
  nameTagDiv.style.border = '1px solid rgba(255, 255, 255, 0.3)';
  
  // 创建CSS2D对象
  const nameTag = new CSS2DObject(nameTagDiv);
  nameTag.position.set(position.x,  position.y+0.18, position.z); // 在头部上方显示
  nameTag.name = "player_name_tag";
  scene.add(nameTag);
  playerNameTags.set(playerId, nameTag);
  
  return nameTag;
};

/**
 * 更新玩家名字标签位置
 */
const updatePlayerNameTag = (playerId: string, position: Coord3D, playerName: string) => {
  let nameTag = playerNameTags.get(playerId);
  
  if (!nameTag) {
    nameTag = createPlayerNameTag(playerId, position, playerName);
  } else {
    nameTag.position.set(position.x, position.y+0.18, position.z);
    
    // 更新名字（如果名字变了）
    const nameDiv = nameTag.element as HTMLDivElement;
    if (nameDiv.textContent !== playerName) {
      nameDiv.textContent = playerName;
    }
  }
};

/**
 * 更新其他玩家头部模型
 */
const updateOtherPlayersHeads = () => {
  
  Object.keys(playersDataHeadModel.value).forEach(conveyor => {
    const playerData = playersDataHeadModel.value[conveyor];
    
    updatePlayerHeadModel(conveyor, playerData.position, playerData.pitch, playerData.yaw, playerData.camp);
  });
};

/**
 * 移除玩家头部模型和名字标签
 */
const removePlayerHead = (playerId: string) => {
  const nameTag = playerNameTags.get(playerId);
  if (nameTag) {
    scene.remove(nameTag);
    playerNameTags.delete(playerId);
  }
};

/**
 * 更新加载进度
 */
const updateLoadingProgress = (increment = 1, status = '') => {
  loadingState.value.loadedResources += increment;
  const progress = (loadingState.value.loadedResources / loadingState.value.totalResources) * 100;
  loadingState.value.progress = Math.min(100, progress);
  
  if (status) {
    loadingState.value.statusText = status;
  }
  
  // 检查是否所有资源都加载完成
  if (loadingState.value.loadedResources >= loadingState.value.totalResources) {
    setTimeout(() => {
      loadingState.value.isLoading = false;
      loadingState.value.statusText = '场景加载完成！';
    }, 500);
  }
};

/**
 * 棋子运动轨迹更新 棋子轨迹插值
 */ 
const updatepieceTrajectoriesC1 = (delta: number) => {
  const currentTime = Date.now();
  
  Object.keys(pieceTrajectoriesC1.value).forEach(pieceName => {
    const trajectory = pieceTrajectoriesC1.value[pieceName];
    const piece = chessPieces?.getObjectByName(pieceName);
    
    if (!piece || !trajectory || trajectory.points.length < 2) {
      delete pieceTrajectoriesC1.value[pieceName];
      return;
    }

    const elapsed = currentTime - trajectory.startTime;
    const progress = Math.min(elapsed / trajectory.duration, 1);
    
    // 计算当前应该在哪个线段上
    const segmentCount = trajectory.points.length - 1;
    const segmentIndex = Math.floor(progress * segmentCount);
    const segmentProgress = (progress * segmentCount) - segmentIndex;
    
    if (segmentIndex < segmentCount) {
      // 线性插值
      const startPoint = trajectory.points[segmentIndex];
      const endPoint = trajectory.points[segmentIndex + 1];
      
      const currentPosition = {
        x: startPoint.x + (endPoint.x - startPoint.x) * segmentProgress,
        y: startPoint.y + (endPoint.y - startPoint.y) * segmentProgress,
        z: startPoint.z + (endPoint.z - startPoint.z) * segmentProgress
      };
      
      piece.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
    } else {
      // 到达轨迹终点
      const finalPoint = trajectory.points[trajectory.points.length - 1];
      piece.position.set(finalPoint.x, finalPoint.y, finalPoint.z);
      delete pieceTrajectoriesC1.value[pieceName];
    }
  });
};

/**
 * 设置棋子为被其他玩家拾起状态
 */
const setPieceAsPickedByOther = (piece: THREE.Object3D) => {
  const highlightMaterial = new THREE.MeshLambertMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.6
  });
  materialSetObject(piece, highlightMaterial);
};

/**
 * 恢复棋子状态
 */
const restorePieceState = (piece: THREE.Object3D) => {
  materialRestorePieceOriginal(piece);
};

/**
 * 创建可交互对象过滤器
 */
const createIntersectableFilter = (excludePiece: THREE.Object3D | null = null) => {
  return (obj: THREE.Object3D) => {
    return obj !== chessPieces && 
           obj !== excludePiece && 
           obj !== centerGridHelper &&
           obj !== centerAxesHelper &&
           obj !== panoramaCube;};
};

/**
 * 应用棋子偏移修正
 */
const applyPieceOffset = (position: THREE.Vector3, pieceName: string) => {
  const offset = sceneConfig.piecesOffset[pieceName as keyof typeof sceneConfig.piecesOffset];
  if (offset) {
    position.x -= offset.x;
    position.y -= offset.y;
    position.z -= offset.z;
  }
  return position;
};

/**
 * 设置对象及其子对象的材质
 */
const materialSetObject = (object: THREE.Object3D, material: THREE.Material) => {
  if (object instanceof THREE.Mesh) {
    //originalMaterial = object.material;// 只在拾起时保存原始材质，不在这里保存
    object.material = material;
  } else {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        //originalMaterial = child.material;// 只在拾起时保存原始材质，不在这里保存
        child.material = material;
      }
    });
  }
};

/**
 * 恢复对象的原始材质
 */
const materialRestoreObject = (object: THREE.Object3D) => {
  materialRestorePieceOriginal(object);
};

/**
 * 保存棋子的原始材质
 */
const materialSavePieceOriginal = (piece: THREE.Object3D) => {
  if (!piece.name) return;
  
  if (piece instanceof THREE.Mesh) {
    pieceOriginalMaterials.set(piece.name, piece.material);
  } else {
    // 对于组对象，收集所有子网格的材质
    const materials: THREE.Material[] = [];
    piece.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        materials.push(child.material);
      }
    });
    if (materials.length > 0) {
      pieceOriginalMaterials.set(piece.name, materials);
    }
  }
};

/**
 * 恢复棋子的原始材质
 */
const materialRestorePieceOriginal = (piece: THREE.Object3D) => {
  if (!piece.name) return;
  
  const originalMaterial = pieceOriginalMaterials.get(piece.name);
  if (!originalMaterial) return;
  
  if (piece instanceof THREE.Mesh && !Array.isArray(originalMaterial)) {
    piece.material = originalMaterial;
  } else if (Array.isArray(originalMaterial)) {
    // 对于组对象，恢复所有子网格的材质
    let materialIndex = 0;
    piece.traverse((child) => {
      if (child instanceof THREE.Mesh && materialIndex < originalMaterial.length) {
        child.material = originalMaterial[materialIndex];
        materialIndex++;
      }
    });
  }
};


/**
 * 检查并应用暂存的同步数据
 */
const checkAndApplyPendingSyncData = () => {
  if (piecesPendingData.value && chessPieces) {
    // 检查所有棋子是否都已创建
    const allPiecesLoaded = piecesPendingData.value.pieces.every((pieceData: PieceSyncData) => {
      return chessPieces.getObjectByName(pieceData.piece_name);
    });
    
    if (allPiecesLoaded) {
      handleSyncChessPiecesP(piecesPendingData.value);
    }
  }
};

// 处理开始游戏事件
const handleStartGame = (side: 'red' | 'black') => {
  // 修改初始视角
  if(side === 'red'){// 红方相机初始视角
    camera.position.set(cameraConfig.redStartPos.x,cameraConfig.redStartPos.y,cameraConfig.redStartPos.z);
    pitch=cameraConfig.redStartPitch;
    yaw=cameraConfig.redStartYaw;
    ccInstruct.getSelectCampRed();
    setTimeout(
      ()=>{//首次加入时更新位置
       const position = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      };
      ccInstruct.broadcastHeadPositionPitchYaw('', position, pitch, yaw, selectedCampC1.value);
      }
      ,0
    );
    // 隐藏红方头部模型（自己的模型）
    if (playerHeadBox_1) {
      playerHeadBox_1.visible = false;
    }
  }
  if(side === 'black'){// 黑方相机初始视角
    camera.position.set(cameraConfig.blackStartPos.x,cameraConfig.blackStartPos.y,cameraConfig.blackStartPos.z);
    pitch=cameraConfig.blackStartPitch;
    yaw=cameraConfig.blackStartYaw;
    ccInstruct.getSelectCampBlack();
    setTimeout(
      ()=>{//首次加入时更新位置
       const position = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      };
      ccInstruct.broadcastHeadPositionPitchYaw('', position, pitch, yaw, selectedCampC1.value);
      }
      ,0
    );
    // 隐藏黑方头部模型（自己的模型）
    if (playerHeadBox_2) {
      playerHeadBox_2.visible = false;
    }
  }
  const quaternion = new THREE.Quaternion();
  quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  camera.setRotationFromQuaternion(quaternion);
  // 应用游戏设置
  applyGameSettings();
  
  // 更新其他玩家头部可见性
  updatePlayerHeadVisibility();
};

// 应用游戏设置
const applyGameSettings = () => {
  const settings = gameSettingStore.gameSettings;
  // 修改fov
  if (camera) {
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
  }
  // 修改环境光
  if (ambientLight) {
    ambientLight.intensity = settings.ambientIntensity;
  }
  console.log('设置已应用');
};

// 显示菜单
const showStartMenu = () => {
  if (startMenuRef.value) {
    startMenuRef.value.isVisible=true;
  }
};
// 显示确认头像确认框
const showGiveUpConfirm = ()=>{
  if(giveUpConfirmRef.value){
    giveUpConfirmRef.value.isVisible=true;
  }
}

const initScene = () => {
  if (!sceneRef.value) return;
  createScene();// 场景
  createCamera();// 相机
  createRenderer();// 渲染器
  createLights();// 灯光
  //createPanoramaCube();// 全景图
  createHelpers();// 辅助对象
  createGround();// 地面
  //createCoffeeTable();// 咖啡桌
  createGraniteSlate();
  createChessBoard();// 棋盘
  createChessPieces();// 棋子
  createPlayerHeadBox1();// 
  createPlayerHeadBox2();// 
  initLabelRenderer();
  calculateTotalResources();
}

/**
 * 初始化CSS2D渲染器用于显示名字标签
 */
const initLabelRenderer = () => {
  if (!sceneRef.value) return;
  
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  labelRenderer.domElement.style.zIndex = '1000'; // 确保在正确层级
  
  // 添加到场景容器中
  sceneRef.value.appendChild(labelRenderer.domElement);
};

/**
 * 初始化交互系统
 */
const initInteractionSystem = () => {
  raycaster = new THREE.Raycaster();// 初始化射线投射器
  transparentMaterial = new THREE.MeshLambertMaterial({
    transparent: true,
    opacity: sceneConfig.pieceInteraction.transparency,
    color: 0xffffff // 确保透明材质也有基础颜色
  });
  if (renderer.domElement) {// 添加鼠标键盘事件监听
    renderer.domElement.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
  }
  const element = renderer.domElement;// 初始化指针锁定
  element.addEventListener('click', () => {
    if (!isPointerLocked) {
      element.requestPointerLock();
    }
  });
  document.addEventListener('pointerlockchange', onPointerLockChange);// 指针锁定状态变化事件
  document.addEventListener('mozpointerlockchange', onPointerLockChange);
}

/**
 * 指针锁定状态变化处理
 */
const onPointerLockChange = () => {
  const wasPointerLocked = isPointerLocked;
  isPointerLocked = document.pointerLockElement === renderer.domElement;
  
  // 当指针锁定状态变化时，更新光标样式
  if (renderer?.domElement) {
    if (isPointerLocked) {
      // 锁定时光标隐藏
      renderer.domElement.style.cursor = 'none';
    } else {
      // 解除锁定时光标显示为默认
      renderer.domElement.style.cursor = 'default';
    }
  }
}

/**
 * 鼠标点击事件处理
 */
const onClick = (event: MouseEvent) => {
  if (!isPointerLocked) return;
  isPicking ? placePiece() : tryPickPiece();
}

/**
 * 鼠标移动事件处理（第一人称视角控制）
 */
const onMouseMove = (event: MouseEvent) => {
  if (!isPointerLocked) return;
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;
  yaw -= (movementX * rotationSpeed) * gameSettingStore.gameSettings.mouseSensitivity/100;// 使用四元数控制相机旋转，避免万向节锁
  pitch -= (movementY * rotationSpeed) * gameSettingStore.gameSettings.mouseSensitivity/100;
  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));// 限制俯仰角范围（避免翻转）
  const quaternion = new THREE.Quaternion();// 使用四元数设置相机旋转
  quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  camera.setRotationFromQuaternion(quaternion);
}

/**
 * 键盘按下事件处理
 */
const onKeyDown = (event: KeyboardEvent) => {
  if (!isPointerLocked) return;
  const keyActions: { [key: string]: () => void } = {
    'ArrowUp': () => moveState.forward = true,
    'KeyW': () => moveState.forward = true,
    'ArrowLeft': () => moveState.left = true,
    'KeyA': () => moveState.left = true,
    'ArrowDown': () => moveState.backward = true,
    'KeyS': () => moveState.backward = true,
    'ArrowRight': () => moveState.right = true,
    'KeyD': () => moveState.right = true,
    'Space': () => {
      if (canJump) {
        velocity.y += sceneConfig.firstPerson.jumpForce;
        canJump = false;
      }
    }
  };
  keyActions[event.code]?.();
}

/**
 * 键盘释放事件处理
 */
const onKeyUp = (event: KeyboardEvent) => {
  if (!isPointerLocked) return;
  const keyActions: { [key: string]: () => void } = {
    'ArrowUp': () => moveState.forward = false,
    'KeyW': () => moveState.forward = false,
    'ArrowLeft': () => moveState.left = false,
    'KeyA': () => moveState.left = false,
    'ArrowDown': () => moveState.backward = false,
    'KeyS': () => moveState.backward = false,
    'ArrowRight': () => moveState.right = false,
    'KeyD': () => moveState.right = false
  };
  keyActions[event.code]?.();
}

/**
 * 尝试拿起棋子
 */
const tryPickPiece = () => {
  if (isPicking || !chessPieces) return;
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(chessPieces.children, true);
  
  if (intersects.length > 0) {
    let piece = intersects[0].object;
    while (piece.parent && piece.parent !== chessPieces && piece.parent !== scene) {
      piece = piece.parent;
    }
    if (chessPieces.children.includes(piece)) {
      // 检查棋子是否已被其他玩家拾起
      const pieceState = chessPiecesState.value[piece.name];
      if (pieceState && pieceState.isPicked && pieceState.pickedBy) {
        console.log(`棋子 ${piece.name} 已被玩家 ${pieceState.pickedBy} 拾起，无法操作`);
        return;
      }
      
      pickUpPiece(piece);
      
      // 发送拾起棋子指令到服务器
      const position = {
        x: piece.position.x,
        y: piece.position.y,
        z: piece.position.z
      };
      ccInstruct.broadcastPickUpChess('',piece.name, position);
      
      // 初始化移动轨迹
      moveTrajectory = [position];
      lastMoveBroadcastTime = Date.now();
    }
  }
}

/**
 * 拿起棋子
 */
const pickUpPiece = (piece: THREE.Object3D) => {
  isPicking = true;
  pickedPiece = piece;
  materialSetObject(piece, transparentMaterial);
}

/**
 * 放下棋子
 */
const placePiece = () => {
  if (!pickedPiece) return;
  
  const pieceName = pickedPiece.name;
  if (!pieceName) return;
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersectableObjects = scene.children.filter(createIntersectableFilter(pickedPiece));
  const intersects = raycaster.intersectObjects(intersectableObjects, true);
  
  if (intersects.length === 0) return;
  
  const targetPosition = intersects[0].point.clone();
  const adjustedPosition = applyPieceOffset(targetPosition, pieceName);
  pickedPiece.position.copy(adjustedPosition);
  
  // 恢复原始材质
  materialRestoreObject(pickedPiece);
  
  // 发送放置棋子指令到服务器
  const position = {
    x: pickedPiece.position.x,
    y: pickedPiece.position.y,
    z: pickedPiece.position.z
  };
  ccInstruct.broadcastPickDownChess('', pieceName, position);
  
  // 清理移动轨迹
  moveTrajectory = [];
  
  resetPickingState();
}

/**
 * 重置拾取状态
 */
const resetPickingState = () => {
  isPicking = false;
  pickedPiece = null;
  originalMaterial = null;
}

/**
 * 更新棋子跟随视角
 * 注意：为了让玩家可视化棋子的放置点，如果视线与棋盘或桌子存在交叉点则这个棋子应该在桌子或棋盘之上，否则默认悬浮在视线的前方。
 */
const updatePieceFollowing = () => {
  if (!isPicking || !pickedPiece) return;
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersectableObjects = scene.children.filter(createIntersectableFilter(pickedPiece));
  const intersects = raycaster.intersectObjects(intersectableObjects, true);
  
  let targetPosition: THREE.Vector3;
  
  if (intersects.length > 0) {
    const intersect = intersects[0];
    targetPosition = intersect.point.clone();
    
    const bbox = new THREE.Box3().setFromObject(pickedPiece);
    const bottomOffset = bbox.min.y;
    targetPosition.y -= bottomOffset;
    
    const pieceName = pickedPiece.name as keyof typeof sceneConfig.piecesOffset;
    if (sceneConfig.piecesOffset[pieceName]) {
      targetPosition.x -= sceneConfig.piecesOffset[pieceName].x;
      targetPosition.z -= sceneConfig.piecesOffset[pieceName].z;
    }
    
    targetPosition.y += 0.001;
  } 
  else {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    targetPosition = camera.position.clone().add(direction.multiplyScalar(0.1));
  }
  
  pickedPiece.position.lerp(targetPosition, sceneConfig.pieceInteraction.followSpeed);
  
  // 记录移动轨迹并定期发送
  const currentTime = Date.now();
  if (currentTime - lastMoveBroadcastTime >= gameTick) {
    const currentPosition = {
      x: pickedPiece.position.x,
      y: pickedPiece.position.y,
      z: pickedPiece.position.z
    };
    
    moveTrajectory.push(currentPosition);
    
    // 限制轨迹长度，避免数据过大
    if (moveTrajectory.length > 10) {
      moveTrajectory = moveTrajectory.slice(-10);
    }
    
    // 发送移动中棋子指令
    ccInstruct.broadcastMovingChess('',pickedPiece.name, moveTrajectory);
    
    lastMoveBroadcastTime = currentTime;
  }
}

/**
 * 更新第一人称移动
 */
const updateFirstPersonMovement = (delta: number) => {
  if (!isPointerLocked) return;
  
  velocity.x -= velocity.x * 10.0 * delta;// 根据移动方向更新速度
  velocity.z -= velocity.z * 10.0 * delta;
  
  direction.z = Number(moveState.forward) - Number(moveState.backward);
  direction.x = Number(moveState.right) - Number(moveState.left);
  direction.normalize();// 确保对角线移动不会更快
  
  if (!moveState.forward && !moveState.backward && !moveState.left && !moveState.right) {// 如果没有移动输入，确保速度归零
    velocity.x = 0;
    velocity.z = 0;
  }
  
  if (moveState.forward || moveState.backward || moveState.left || moveState.right) {// 使用相机的方向来正确计算移动
    const cameraDirection = new THREE.Vector3();// 获取相机的方向向量（看向的方向）
    camera.getWorldDirection(cameraDirection);

    const cameraRight = new THREE.Vector3();// 创建右侧方向向量（相机的右侧）
    cameraRight.crossVectors(cameraDirection, camera.up).normalize();
    
    const moveDirection = new THREE.Vector3(0, 0, 0);// 重置移动方向
    
    if (moveState.forward) moveDirection.add(cameraDirection);// 前后移动：沿着相机看向的方向
    if (moveState.backward) moveDirection.sub(cameraDirection);
    if (moveState.left) moveDirection.sub(cameraRight);// 左右移动：沿着相机右侧方向
    if (moveState.right) moveDirection.add(cameraRight);
    
    moveDirection.y = 0;// 移除Y轴分量，确保只在水平面移动
    moveDirection.normalize();
    
    velocity.x += moveDirection.x * (sceneConfig.firstPerson.moveSpeed * gameSettingStore.gameSettings.moveSensitivity/100) * delta;// 应用移动速度
    velocity.z += moveDirection.z * (sceneConfig.firstPerson.moveSpeed * gameSettingStore.gameSettings.moveSensitivity/100) * delta;
  }
  
  velocity.y -= sceneConfig.firstPerson.gravity * delta;// 应用重力
  
  camera.position.x += velocity.x * delta;// 移动相机 - 使用直接位置更新而不是translate
  camera.position.y += velocity.y * delta;
  camera.position.z += velocity.z * delta;
  
  if (camera.position.y < sceneConfig.firstPerson.playerHeight) {// 简单的碰撞检测（防止穿过地面）
    velocity.y = 0;
    camera.position.y = sceneConfig.firstPerson.playerHeight;
    canJump = true;
  }
}

// ==============================
// 场景创建函数
// ==============================

/**
 * 设置非反光材质
 */
const setNonReflectiveMaterial = (model: THREE.Group) => {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // 创建非反光材质
      const nonReflectiveMaterial = new THREE.MeshLambertMaterial();
      
      // 如果原始材质有贴图，复制贴图
      if (child.material instanceof THREE.Material) {
        const originalMaterial = child.material as any;
        
        // 复制基础属性
        if (originalMaterial.map) nonReflectiveMaterial.map = originalMaterial.map;
        if (originalMaterial.color) nonReflectiveMaterial.color = originalMaterial.color.clone();
        if (originalMaterial.transparent !== undefined) nonReflectiveMaterial.transparent = originalMaterial.transparent;
        if (originalMaterial.opacity !== undefined) nonReflectiveMaterial.opacity = originalMaterial.opacity;
        
        // 确保贴图正确设置
        if (nonReflectiveMaterial.map) {
          nonReflectiveMaterial.map.needsUpdate = true;
        }
      }
      
      child.material = nonReflectiveMaterial;
      child.receiveShadow = true;
      child.castShadow = true;
    }
  });
}

/**
 * 创建Three.js场景
 */
const createScene = () => {
  scene = new THREE.Scene();
  scene.name = "root_scene";
  scene.background = new THREE.Color(sceneConfig.color.tempBackgroundColor);
}

/**
 * 创建透视相机
 */
const createCamera = () => {
  const aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(
    cameraConfig.fov, 
    aspectRatio, 
    cameraConfig.near, 
    cameraConfig.far
  );
  camera.position.set(
    cameraConfig.position.x,
    cameraConfig.position.y,
    cameraConfig.position.z
  );
  pitch = 0;// 初始化旋转角度
  yaw = 0;
  const quaternion = new THREE.Quaternion();// 设置初始朝向（看向负Z轴）
  quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  camera.setRotationFromQuaternion(quaternion);
  camera.name = "player_camera";
}

/**
 * 创建WebGL渲染器
 */
const createRenderer = () => {
  if (!sceneRef.value) return;
  renderer = new THREE.WebGLRenderer({ 
    antialias: rendererConfig.antialias,
    alpha: rendererConfig.alpha
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = rendererConfig.shadowMap.enabled;
  renderer.shadowMap.type = rendererConfig.shadowMap.type;
  sceneRef.value.appendChild(renderer.domElement);
}

/**
 * 创建场景灯光
 */
const createLights = () => {
  // 顶部光源1
  directionalLight1 = new THREE.DirectionalLight(
    lightConfig.directional.color, 
    lightConfig.directional.intensity
  );
  directionalLight1.position.set(
    lightConfig.directional.position.x,
    lightConfig.directional.position.y,
    lightConfig.directional.position.z
  );
  directionalLight1.castShadow = true;
  let shadowConfig = lightConfig.directional.shadow;
  directionalLight1.shadow.mapSize.width = shadowConfig.mapSize.width;
  directionalLight1.shadow.mapSize.height = shadowConfig.mapSize.height;
  directionalLight1.shadow.camera.near = shadowConfig.camera.near;
  directionalLight1.shadow.camera.far = shadowConfig.camera.far;
  directionalLight1.shadow.camera.left = shadowConfig.camera.left;
  directionalLight1.shadow.camera.right = shadowConfig.camera.right;
  directionalLight1.shadow.camera.top = shadowConfig.camera.top;
  directionalLight1.shadow.camera.bottom = shadowConfig.camera.bottom;
  directionalLight1.name="directional_light1";
  scene.add(directionalLight1);
  
  // 顶部光源2
  directionalLight2 = new THREE.DirectionalLight(
    lightConfig.directional2.color, 
    lightConfig.directional2.intensity
  );
  directionalLight2.position.set(
    lightConfig.directional2.position.x,
    lightConfig.directional2.position.y,
    lightConfig.directional2.position.z
  );
  directionalLight2.castShadow = true;
  shadowConfig = lightConfig.directional2.shadow;
  directionalLight2.shadow.mapSize.width = shadowConfig.mapSize.width;
  directionalLight2.shadow.mapSize.height = shadowConfig.mapSize.height;
  directionalLight2.shadow.camera.near = shadowConfig.camera.near;
  directionalLight2.shadow.camera.far = shadowConfig.camera.far;
  directionalLight2.shadow.camera.left = shadowConfig.camera.left;
  directionalLight2.shadow.camera.right = shadowConfig.camera.right;
  directionalLight2.shadow.camera.top = shadowConfig.camera.top;
  directionalLight2.shadow.camera.bottom = shadowConfig.camera.bottom;
  directionalLight2.name="directional_light2";
  scene.add(directionalLight2);
  
  // 添加补光光源
  fillLight = new THREE.DirectionalLight(
    lightConfig.fillLight.color,
    lightConfig.fillLight.intensity
  );
  fillLight.position.set(
    lightConfig.fillLight.position.x,
    lightConfig.fillLight.position.y,
    lightConfig.fillLight.position.z
  );
  fillLight.castShadow = false;
  fillLight.name="fill_light";
  scene.add(fillLight);
  
  // 环境光源
  ambientLight = new THREE.AmbientLight(
    lightConfig.ambient.color, 
    lightConfig.ambient.intensity
  );
  ambientLight.name="ambient_light";
  scene.add(ambientLight);
}

/**
 * 创建移动箭头
 */
const createMoveArrow = (start: Coord3D, end: Coord3D, camp: string, pieceName: string): THREE.Group => {
  const pn = pieceName as PieceNameKeys;
  const pieceOffset: Coord3D = sceneConfig.piecesOffset[pn];
  const startAdj: Coord3D = {x:start.x+pieceOffset.x,y:start.y+pieceOffset.y,z:start.z+pieceOffset.z};
  const endAdj: Coord3D = {x:end.x+pieceOffset.x,y:end.y+pieceOffset.y,z:end.z+pieceOffset.z};
  const group = new THREE.Group();
  
  // 计算方向向量和距离
  const direction = new THREE.Vector3(
    endAdj.x - startAdj.x,
    0,
    endAdj.z - startAdj.z
  );
  const distance = direction.length() - sceneConfig.moveArrow.margin;
  const angle = Tool.adjustAngle(Math.atan2(direction.x, direction.z),Math.PI/2);
  direction.normalize();
  
  // 根据阵营设置颜色
  let arrowColor: number;
  switch (camp) {
    case 'red':
      arrowColor = sceneConfig.moveArrow.color.red;
      break;
    case 'black':
      arrowColor = sceneConfig.moveArrow.color.black;
      break;
    default:
      arrowColor = sceneConfig.moveArrow.color.default;
  }
  
  // 创建箭头身体（长方形）
  const bodyLength = distance - sceneConfig.moveArrow.size.arrowHeadLength;
  
  const bodyGeometry = new THREE.PlaneGeometry(
    bodyLength,
    sceneConfig.moveArrow.size.lineWidth
  );
  
  const bodyMaterial = new THREE.MeshBasicMaterial({ 
    color: arrowColor,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });
  
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  
  // 放置箭头身体
  const bodyPosition = new THREE.Vector3(
    startAdj.x + direction.x * bodyLength / 2,
    sceneConfig.moveArrow.height,
    startAdj.z + direction.z * bodyLength / 2
  );
  
  body.position.copy(bodyPosition);
  
  // 旋转箭头身体指向正确方向
  body.rotation.z = angle;
  
  body.rotation.x = -Math.PI / 2; // 使其平放在xz平面上
  
  // 创建箭头头部（三角形）
  const headGeometry = new THREE.Shape();
  
  const headWidth = sceneConfig.moveArrow.size.arrowHeadWidth;
  
  const headLength = sceneConfig.moveArrow.size.arrowHeadLength;
  
  headGeometry.moveTo(0, -headWidth / 2);
  
  headGeometry.lineTo(headLength, 0);
  
  headGeometry.lineTo(0, headWidth / 2);
  
  headGeometry.lineTo(0, -headWidth / 2);
  
  
  const headShapeGeometry = new THREE.ShapeGeometry(headGeometry);
  
  const headMaterial = new THREE.MeshBasicMaterial({ 
    color: arrowColor,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });
  
  const head = new THREE.Mesh(headShapeGeometry, headMaterial);
  
  // 放置箭头头部
  const headPosition = new THREE.Vector3(
    startAdj.x + direction.x * bodyLength,
    sceneConfig.moveArrow.height,
    startAdj.z + direction.z * bodyLength
  );
  
  head.position.copy(headPosition);
  
  // 旋转箭头头部指向正确方向
  head.rotation.z = Tool.adjustAngle(angle,Math.PI);
  
  head.rotation.x = -Math.PI / 2; // 使其平放在xz平面上
  
  group.add(body);
  group.add(head);
  
  return group;
};

/**
 * 添加移动箭头到场景
 */
const addMoveArrow = (start: Coord3D, end: Coord3D, camp: string, conveyor: string, pieceName: string) => {
  if (!sceneConfig.moveArrow.enabled) return;
  // 创建箭头组
  const arrowGroup = createMoveArrow(start, end, camp, pieceName);
  arrowGroup.name = "arrow_group";
  // 添加到场景
  scene.add(arrowGroup);
};

/**
 * 移除场景中所有走子箭头的对象
 */
const removeAllArrowGroups = () => {
  if (!scene) {
    return;
  }
  // 收集所有需要移除的对象
  const objectsToRemove: THREE.Object3D[] = [];
  // 遍历场景中的所有对象
  scene.traverse((object) => {
    if (object.name === 'arrow_group') {
      objectsToRemove.push(object);
    }
  });
  // 移除所有找到的对象
  objectsToRemove.forEach((object) => {
    // 从父级中移除对象
    if (object.parent) {
      object.parent.remove(object);
    }
    // 清理对象的几何体
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // 清理几何体
        if (child.geometry) {
          child.geometry.dispose();
        }
      }
    });
  });
};

/**
 * 创建辅助对象（网格、坐标轴）
 */
const createHelpers = () => {
  centerGridHelper = new THREE.GridHelper(// 网格辅助对象
    sceneConfig.helpers.grid.size,
    sceneConfig.helpers.grid.divisions,
    sceneConfig.color.helperGridCenterLine,
    sceneConfig.color.helperGrid
  );
  centerGridHelper.position.y = sceneConfig.helpers.grid.position.y;
  centerAxesHelper = new THREE.AxesHelper(sceneConfig.helpers.axes.size);// 坐标轴辅助对象
  centerAxesHelper.setColors(sceneConfig.color.axesX, sceneConfig.color.axesY, sceneConfig.color.axesZ);
  centerGridHelper.name="center_grid_helper";
  centerAxesHelper.name="center_axes_helper";
  scene.add(centerGridHelper);
  scene.add(centerAxesHelper);
}

/**
 * 创建地面
 */
const createGround = () => {
  const groundGeometry = new THREE.PlaneGeometry(
    sceneConfig.S_ground.size.width, 
    sceneConfig.S_ground.size.height
  );
  const groundMaterial = new THREE.MeshLambertMaterial({ 
    color: sceneConfig.S_ground.color,
    transparent: true,
    opacity: sceneConfig.S_ground.opacity
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'S_ground';
  scene.add(ground);
}

/**
 * 创建全景立方体背景
 */
const createPanoramaCube = () => {
  const cubeSize = sceneConfig.panorama.size;
  const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const sides = [
    { path: sceneConfig.panorama.texturePaths.right, name: 'right' },
    { path: sceneConfig.panorama.texturePaths.left, name: 'left' },
    { path: sceneConfig.panorama.texturePaths.top, name: 'top' },
    { path: sceneConfig.panorama.texturePaths.bottom, name: 'bottom' },
    { path: sceneConfig.panorama.texturePaths.front, name: 'front' },
    { path: sceneConfig.panorama.texturePaths.back, name: 'back' }
  ];
  
  const textureLoader = new THREE.TextureLoader();
  let loadedTextures = 0;
  const totalTextures = sides.length;
  
  const materials = sides.map((side, index) => {
    return new Promise<THREE.Material>((resolve) => {
      try {
        const texture = textureLoader.load(
          side.path,
          () => {
            // 纹理加载成功
            loadedTextures++;
            updateLoadingProgress(1, `加载全景纹理... (${loadedTextures}/${totalTextures})`);
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.BackSide,
              transparent: false
            });
            resolve(material);
          },
          undefined,
          (error) => {
            // 纹理加载失败，使用回退颜色
            console.error(`全景纹理加载失败: ${side.path}`, error);
            loadedTextures++;
            updateLoadingProgress(1, `加载全景纹理... (${loadedTextures}/${totalTextures})`);
            
            const fallbackColor = sceneConfig.color.fallBackPanorama[index];
            const material = new THREE.MeshBasicMaterial({
              color: fallbackColor,
              side: THREE.BackSide,
              transparent: false
            });
            resolve(material);
          }
        );
      } catch (error) {
        // 加载异常处理
        console.error(`全景纹理加载异常: ${side.path}`, error);
        loadedTextures++;
        updateLoadingProgress(1, `加载全景纹理... (${loadedTextures}/${totalTextures})`);
        
        const fallbackColor = sceneConfig.color.fallBackPanorama[index];
        const material = new THREE.MeshBasicMaterial({
          color: fallbackColor,
          side: THREE.BackSide,
          transparent: false
        });
        resolve(material);
      }
    });
  });

  // 等待所有材质加载完成
  Promise.all(materials).then((loadedMaterials) => {
    panoramaCube = new THREE.Mesh(geometry, loadedMaterials);
    panoramaCube.name = 'panorama_cube';
    scene.add(panoramaCube);
  });
};

/**
 * 创建/加载外部模型
 * @param modelPath 模型文件路径
 * @param position 初始化位置
 * @param scale 初始化缩放比
 * @param name 模型名称
 * @param onLoad 加载完毕回调事件
 */
const createModel = (
  modelPath: string, 
  position: { x: number, y: number, z: number }, 
  scale: number,
  name: string,
  onLoad?: (group: THREE.Group) => void
) => {
  const loader = new GLTFLoader();
  
  updateLoadingProgress(0, `加载${name}模型...`);
  
  loader.load(
    modelPath,
    (gltf) => {
      const model = gltf.scene;
      model.position.set(position.x, position.y, position.z);
      model.scale.set(scale, scale, scale);
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.name = name;
        }
      });
      
      // 获取模型高度等信息
      const bbox = new THREE.Box3().setFromObject(model);
      switch (name) {
        case 'S_table':{sceneConfig.altitude.S_table = bbox.max.y;break;}
        case 'S_chess_board':{sceneConfig.altitude.S_chess_board = bbox.max.y;break;}
        case 'S_granite_slate':{sceneConfig.altitude.S_granite_slate = bbox.max.y;break;}
        case 'V_Player_head_box_1':{
          sceneConfig.altitude.V_Player_head_box_1 = bbox.max.y;
          sceneConfig.playerHeadBoxOffset.rad_1.x = model.children[0].position.x;
          sceneConfig.playerHeadBoxOffset.rad_1.y = model.children[0].position.y;
          sceneConfig.playerHeadBoxOffset.rad_1.z = model.children[0].position.z;
          break;
        }
        case 'V_Player_head_box_2':{
          sceneConfig.altitude.V_Player_head_box_2 = bbox.max.y;
          sceneConfig.playerHeadBoxOffset.black_2.x = model.children[0].position.x;
          sceneConfig.playerHeadBoxOffset.black_2.y = model.children[0].position.y;
          sceneConfig.playerHeadBoxOffset.black_2.z = model.children[0].position.z;
          break;
        }
      }
      
      onLoad?.(model);
      model.name = name;
      scene.add(model);
      
      // 更新加载进度
      updateLoadingProgress(1, `${name}模型加载完成`);
    },
    (progress) => {
      // 加载进度更新
      const percent = (progress.loaded / progress.total) * 100;
      loadingState.value.statusText = `加载${name}模型... ${Math.round(percent)}%`;
    },
    (error) => {
      console.error(`${name}模型加载失败:`, error);
      // 即使加载失败也要更新进度
      updateLoadingProgress(1, `${name}模型加载失败，使用默认设置`);
    }
  );
};

/**
 * 加载咖啡桌模型
 */
const createCoffeeTable = () => {
  createModel(
    sceneConfig.S_table.modelPath,
    sceneConfig.S_table.position,
    sceneConfig.S_table.scale,
    'S_table',
    (model) => { coffeeTable = model; }
  );
}

/**
 * 加载花岗岩石板模型
 */
const createGraniteSlate = () => {
  createModel(
    sceneConfig.S_granite_slate.modelPath,
    sceneConfig.S_granite_slate.position,
    sceneConfig.S_granite_slate.scale,
    'S_granite_slate',
    (model) => { gGraniteSlate = model; }
  );
}

/**
 * 加载头模型
 */
const createPlayerHeadBox1 = () => {
  createModel(
    sceneConfig.V_Player_head_box_1.modelPath,
    sceneConfig.V_Player_head_box_1.position,
    sceneConfig.V_Player_head_box_1.scale,
    'V_Player_head_box_1',
    (model) => { 
      playerHeadBox_1 = model;
      setNonReflectiveMaterial(playerHeadBox_1);// 设置非反光材质
      playerHeadBox_1.visible = false;
      // 遍历所有子对象，确保都隐藏
      playerHeadBox_1.traverse((child) => {
        child.visible = false;
      });
    }
  );
}

/**
 * 加载头模型
 */
const createPlayerHeadBox2 = () => {
  createModel(
    sceneConfig.V_Player_head_box_2.modelPath,
    sceneConfig.V_Player_head_box_2.position,
    sceneConfig.V_Player_head_box_2.scale,
    'V_Player_head_box_2',
    (model) => { 
      playerHeadBox_2 = model;
      setNonReflectiveMaterial(playerHeadBox_2);// 设置非反光材质
      playerHeadBox_2.visible = false;
      // 遍历所有子对象，确保都隐藏
      playerHeadBox_2.traverse((child) => {
        child.visible = false;
      });
    }
  );
}

/**
 * 加载棋盘模型
 */
const createChessBoard = () => {
  createModel(
    sceneConfig.S_chess_board.modelPath,
    sceneConfig.S_chess_board.position,
    sceneConfig.S_chess_board.scale,
    'S_chess_board',
    (model) => { chessBoard = model; }
  );
}

/**
 * 创建棋子
 */
const createChessPieces = () => {
  const loader = new GLTFLoader();
  chessPieces = new THREE.Group();
  chessPieces.name = 'chess_pieces_group';
  
  let loadedPieces = 0;
  const totalPieces = piecesConfig.length;
  
  piecesConfig.forEach((pieceConfig, index) => {
    updateLoadingProgress(0, `加载棋子模型... (${loadedPieces}/${totalPieces})`);
    
    loader.load(
      pieceConfig.modelPath,
      (gltf) => {
        const piece = gltf.scene;
        piece.position.set(
          pieceConfig.position.x,
          pieceConfig.position.y,
          pieceConfig.position.z
        );
        piece.scale.set(
          pieceConfig.scale,
          pieceConfig.scale,
          pieceConfig.scale
        );
        piece.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        piece.name = pieceConfig.name;
        
        // 保存棋子的原始材质
        materialSavePieceOriginal(piece);
        
        // 计算棋子尺寸（只在第一个棋子时计算）
        if (index === 0) {
          const pieceBbox = new THREE.Box3().setFromObject(piece);
          sceneConfig.altitude.S_chess_pieces_max = pieceBbox.max.y;
          sceneConfig.altitude.S_chess_pieces_min = pieceBbox.min.y;
          sceneConfig.altitude.S_chess_pieces_height = 
            sceneConfig.altitude.S_chess_pieces_max - sceneConfig.altitude.S_chess_pieces_min;
          sceneConfig.altitude.S_chess_pieces_max_plus = 
            sceneConfig.altitude.S_chess_pieces_max - sceneConfig.altitude.S_chess_pieces_height;
        }
        
        // 记录棋子偏移
        const pos_xyz = {
          x: piece.children[0].position.x,
          y: piece.children[0].position.y,
          z: piece.children[0].position.z,
        };
        const pieceName = pieceConfig.name as keyof typeof sceneConfig.piecesOffset;
        if (sceneConfig.piecesOffset[pieceName]) {
          sceneConfig.piecesOffset[pieceName].x = pos_xyz.x;
          sceneConfig.piecesOffset[pieceName].y = pos_xyz.y - (sceneConfig.altitude.S_chess_pieces_height/2);
          sceneConfig.piecesOffset[pieceName].z = pos_xyz.z;
        }
        
        chessPieces.add(piece);
        loadedPieces++;
        updateLoadingProgress(1, `加载棋子模型... (${loadedPieces}/${totalPieces})`);
        
        // 每次加载完一个棋子都检查是否有待处理的同步数据
        if (loadedPieces === totalPieces) {
          // 所有棋子加载完成，检查是否有待处理的同步数据
          setTimeout(() => {
            checkAndApplyPendingSyncData();
          }, 100);
        }
      },
      undefined,
      (error) => {
        console.error(`棋子模型加载失败: ${pieceConfig.modelPath}`, error);
        loadedPieces++;
        updateLoadingProgress(1, `加载棋子模型... (${loadedPieces}/${totalPieces})`);
        
        // 即使有棋子加载失败，也要检查同步数据
        if (loadedPieces === totalPieces) {
          setTimeout(() => {
            checkAndApplyPendingSyncData();
          }, 100);
        }
      }
    );
  });
  scene.add(chessPieces);
};

/**
 * 动画循环
 */
const animate = () => {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  prevTime = time;
  
  updateFirstPersonMovement(delta);
  updatePieceFollowing();
  updatepieceTrajectoriesC1(delta);
  
  // 平滑更新其他玩家头部
  smoothUpdatePlayerHeads(delta);
  
  // 定期广播头部位置
  if (time % gameTick < delta * 1000) {
    if(selectedCampC1.value === 'red' || selectedCampC1.value === 'black'){
      if (!isPointerLocked) return;
      const position = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      };
      ccInstruct.broadcastHeadPositionPitchYaw('', position, pitch, yaw, selectedCampC1.value);
    }
  }
  
  updateOtherPlayersHeads();// 更新其他玩家头部模型
  if (enabledDebug) updateDebugInfo();//更新调试信息
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
    if (labelRenderer) {
      labelRenderer.render(scene, camera);
    }
  }
};

// ==============================
// 生命周期钩子等
// ==============================
onMounted(() => {
  window.addEventListener('resize', () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  initScene();
  initInteractionSystem();
  animate();
});

onUnmounted(() => {
  removeAllArrowGroups();// 清理移动箭头
  if (renderer) {// 清理资源
    if (renderer.domElement) {// 移除事件监听器
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.style.cursor = 'default';
    }
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    document.removeEventListener('mozpointerlockchange', onPointerLockChange);
    renderer.dispose();
    if (headBroadcastInterval) clearInterval(headBroadcastInterval);// 清理头部广播定时器
    playerNameTags.forEach((nameTag, playerId) => {scene.remove(nameTag);});// 清理名字标签
    playerNameTags.clear();
    if (labelRenderer && labelRenderer.domElement.parentNode) labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);// 清理标签渲染器
  }
  if (scene) {
    scene.clear();
  }
});

</script>
<template>
  <div class="pageBox">
    <div ref="sceneRef" class="chess-container"></div>
    <div class="crosshair"></div>
    <ViewCC1DebugInfo :enabled-debug="enabledDebug" :debug-info="debugInfoC1"/>
    <ViewUserLayer theme="light" design="C" @click-logout="ccInstruct.closeLink()"/>
    <ViewHeart ref="heartRef" @like-change="handleHeart3" label="Like" />
    <ViewCC1Menu @click-open-menu="showStartMenu" :open-menu-state="false" :top="80" :left="20"/>
    <ViewCC1GiveUp :give-up-state="giveUpStateC1" @click-give-up="showGiveUpConfirm"/>
    <ViewCC1ResetChess :give-up-state="giveUpStateC1" :give-up-conveyor="giveUpConveyorC1" @click-reset-chess="ccInstruct.broadcastResetAllChessPieces('')"/>
    <ViewCC1GiveUpConfirm ref="giveUpConfirmRef" :give-up-state="giveUpStateC1" @confirm-give-up="ccInstruct.broadcastGiveUp('')"/>
    <ViewCC1GiveUpResult :give-up-state="giveUpStateC1" :give-up-conveyor="giveUpConveyorC1" @click-reset-chess="ccInstruct.broadcastResetAllChessPieces('')"/>
    <ViewCC1ResetChessResult :reset-chess-count="resetChessCountC1" :reset-chess-conveyor="resetChessConveyorC1"/>
    <ViewCC1Notifications :notifications="notificationArr"/>
    <PartCC1StartMenu ref="startMenuRef" :camp-data="campDataC1" :selected-camp="selectedCampC1" @start-game="handleStartGame" @change-setting="applyGameSettings"/>
    <PartCC1Loading :loading-state="loadingState"/>
    <PartCC1Check/>
  </div>
</template>
<style scoped>
.chess-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  z-index: 10;
  top: 0;
  left: 0;
  overflow: hidden;
}

.pageBox{
  width: 100vw;
  height: 100vh;
}

.player-name-tag {
  color: white;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: Arial, sans-serif;
  pointer-events: none;
  white-space: nowrap;
  text-align: center;
  backdrop-filter: blur(2px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.chess-container > .css2d-label {
  z-index: 1000;
}

.crosshair{
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 4px;
  border: 2px solid white;
  border-radius: 50%;
  background-color: transparent;
  pointer-events: none;
  z-index: 100;
}
/* 保持全屏状态下的样式不变 */
.chess-container:fullscreen,
.chess-container:-webkit-full-screen,
.chess-container:-moz-full-screen {
  /* 保留全屏时的光标隐藏 */
  cursor: none;
}
</style>