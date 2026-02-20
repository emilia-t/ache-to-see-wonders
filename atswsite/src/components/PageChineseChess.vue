<script setup lang="ts">
// The relative position of this file: src/class/PageChineseChess.vue
import { ref, onMounted, onUnmounted }    from 'vue';
import { useGameSettingStore }            from '@/stores/store';

import { ChessSceneManager }              from '@/class/ChessSceneManager';
import { FirstPersonController }          from '@/class/FirstPersonController';
import { ChessPieceManager }              from '@/class/ChessPieceManager';
import { ChessPlayerManager }             from '@/class/ChessPlayerManager';
import { ChessInteractionManager }        from '@/class/ChessInteractionManager';
import { ChessMoveArrowManager }          from '@/class/ChessMoveArrowManager';
import ChineseChessInstruct               from '@/class/ChineseChessInstruct';
import Tool                               from '@/class/Tool';

import type Notification                  from '@/interface/Notification';
import type NotifyUserLineChange          from '@/interface/NotifyUserLineChange';
import type NotifySimple                  from '@/interface/NotifySimple';
import type MessageSimple                 from '@/interface/MessageSimple';
import type CampData                      from '@/interface/CampData';
import type LogConfig                     from '@/interface/LogConfig';
import type InstructObject                from '@/interface/InstructObject';

import { cameraConfig }                   from '@/config/chineseChessConfig.ts';
import { CHINESE_CHESS_SERVER_URL }       from '@/config/apiConfig.ts';

// 导入组件
import ViewUserLayer                      from '@/components/ViewUserLayer.vue';
import ViewHeart                          from '@/components/ViewHeart.vue';
import PartCC1Check                       from '@/components/chinese_chess/PartCC1Check.vue';
import PartCC1Loading                     from '@/components/chinese_chess/PartCC1Loading.vue';
import PartCC1StartMenu                   from '@/components/chinese_chess/PartCC1StartMenu.vue';
import ViewCC1Menu                        from '@/components/chinese_chess/ViewCC1Menu.vue';
import ViewCC1GiveUp                      from '@/components/chinese_chess/ViewCC1GiveUp.vue';
import ViewCC1GiveUpConfirm               from '@/components/chinese_chess/ViewCC1GiveUpConfirm.vue';
import ViewCC1GiveUpResult                from '@/components/chinese_chess/ViewCC1GiveUpResult.vue';
import ViewCC1ResetChess                  from '@/components/chinese_chess/ViewCC1ResetChess.vue';
import ViewCC1ResetChessResult            from '@/components/chinese_chess/ViewCC1ResetChessResult.vue';
import ViewCC1Notifications               from '@/components/chinese_chess/ViewCC1Notifications.vue';
import ViewCC1DebugInfo                   from '@/components/chinese_chess/ViewCC1DebugInfo.vue';
import ViewCC1RequestDraw                 from '@/components/chinese_chess/ViewCC1RequestDraw.vue';
import ViewCC1ResponDraw                  from '@/components/chinese_chess/ViewCC1ResponDraw.vue';
import ViewCC1Message                     from '@/components/chinese_chess/ViewCC1Message.vue';
import ViewCC1SwitchCamp                  from '@/components/chinese_chess/ViewCC1SwitchCamp.vue';
import ViewCC1SwitchCampResult            from '@/components/chinese_chess/ViewCC1SwitchCampResult.vue';

// ==============================
// 管理类实例
// ==============================
let sceneManager: ChessSceneManager;
let firstPersonController: FirstPersonController;
let chessPieceManager: ChessPieceManager;
let playerManager: ChessPlayerManager;
let chessInteractionManager: ChessInteractionManager;
let moveArrowManager: ChessMoveArrowManager;

// ==============================
// 响应式数据
// ==============================
const pendingPiecesData = ref<any>(null);// 待同步的棋子数据
const pendingRbHeadData = ref<any>(null);// 待同步的头部位置数据
const pendingCampData = ref<any>(null);// 待同步的阵营数据
const sceneRef = ref<HTMLDivElement>();
const heartRef = ref<InstanceType<typeof ViewHeart> | null>(null);
const startMenuRef = ref<InstanceType<typeof PartCC1StartMenu> | null>(null);
const giveUpConfirmRef = ref<InstanceType<typeof ViewCC1GiveUpConfirm> | null>(null);

const loadingState = ref({
  isLoading: true,
  progress: 0,
  statusText: '正在初始化场景...',
  loadedResources: 0,
  totalResources: 0
});

const campMyChoiceC1 = ref('');
const campDataC1 = ref<CampData>({
  red: { email: '', name: '', id: 0 },
  black: { email: '', name: '', id: 0 }
});

const messagesSpC1 = ref<MessageSimple[]>([]);
const messageCountSpC1 = ref(0);

const giveUpStateC1 = ref(false);
const giveUpConveyorC1 = ref('');
const giveUpCdTimeC1 = 5;

const requestDrawCounterC1 = ref(0);
const requestDrawConveyorC1 = ref('');
const responseDrawCounterC1 = ref(0);
const responseDrawConveyorC1 = ref('');
const responseDrawStatusC1 = ref(false);

const resetChessCountC1 = ref(0);
const resetChessConveyorC1 = ref('');

const pollTimeM1 = 30;
const pollCountdownM1 = ref(0);
const intervalPollM1 = ref(0);
const pollCountM1 = ref(0);
const pollConveyorM1 = ref('');
const resultCountM1 = ref(0);
const pollResultM1 = ref('');
const voteTotalM1 = ref(0);
const voteAgreeM1 = ref(0);
const voteDisagreeM1 = ref(0);

const notificationArr = ref<Notification[]>([]);
let notificationIdCounter = 0;

const debugInfoC1 = ref({
  cameraPosition: { x: 0, y: 0, z: 0 },
  intersectionPoint: { x: 0, y: 0, z: 0 },
  hasIntersection: false
});
let debugEnabled = false;

const gameSettingStore = useGameSettingStore();
const gameTick = 50;

// ==============================
// 服务器通信
// ==============================
const ccInstruct = new ChineseChessInstruct(CHINESE_CHESS_SERVER_URL);

// 初始化指令处理器
const initInstructionHandlers = () => {
  ccInstruct.onLog = (message: string, type: 'tip' | 'warn' | 'error', data?: any): LogConfig => {
    return {
      code: 0,
      time: Tool.getFormatTime(),
      text: message,
      from: 'ChineseChessInstruct',
      type: type,
      data: data
    };
  };

  ccInstruct.onOpen = (ev: Event): void => {
    console.log("服务器已连接");
    ccInstruct.getPublickey();
    
    const localStorageUserId = localStorage.getItem('user_id');
    const localStorageUserToken = localStorage.getItem('user_token');
    if (localStorageUserId && localStorageUserToken) {
      ccInstruct.getTokenLogin(Number(localStorageUserId), localStorageUserToken);
    }
  };

  ccInstruct.onLogin = (): void => {
    ccInstruct.getCampData();
    ccInstruct.getSyncChessPieces();
    ccInstruct.getRbHeadPositionPitchYaw();
  };

  ccInstruct.onClose = (ev: Event): void => {
    console.log("服务器断开连接", ev);
  };

  ccInstruct.onError = (ev: Event): void => {
    console.log("服务器连接失败", ev);
  };

  ccInstruct.onMessage = (instructObj: InstructObject): void => {
    handleMessage(instructObj);
  };
};

const instructionHandlers = {
  // broadcast 类型指令
  broadcast_pick_up_chess: (conveyor: any, data: any) => handleBroadcastPickUpChess(conveyor, data),
  broadcast_pick_down_chess: (conveyor: any, data: any) => handleBroadcastPickDownChess(conveyor, data),
  broadcast_moving_chess: (conveyor: any, data: any) => handleBroadcastMovingChess(conveyor, data),
  broadcast_head_position_pitch_yaw: (conveyor: any, data: any) => handleBroadcastHeadPositionPitchYaw(conveyor, data),
  broadcast_reset_all_chess_pieces: (conveyor: any, data: any) => handleBroadcastResetAllChessPieces(conveyor, data),
  broadcast_give_up: (conveyor: any, data: any) => handleBroadcastGiveUp(conveyor, data),
  broadcast_user_left_game: (conveyor: any, data: any) => handleBroadcastUserLeftGame(conveyor, data),
  broadcast_user_join_game: (conveyor: any, data: any) => handleBroadcastUserJoinGame(conveyor, data),
  broadcast_request_draw: (conveyor: any, data: any) => handleBroadcastRequestDraw(conveyor, data),
  broadcast_response_draw: (conveyor: any, data: any) => handleBroadcastResponseDraw(conveyor, data),
  broadcast_sp_message: (conveyor: any, data: any) => handleBroadcastSpMessage(conveyor, data),
  // 其他类型指令
  rb_head_position_pitch_yaw: (data: any) => handleRbHeadPositionPitchYaw(data),
  sync_chess_pieces: (data: any) => handleSyncChessPieces(data),
  camp_data: (data: any) => handleCampData(data),
  heart_tk: () => handleHeartTk(),
  select_camp_red: () => handleSelectCampRed(),
  select_camp_black: () => handleSelectCampBlack(),
  switch_camp_poll: (data: any) => handleSwitchCampPoll(data),
  switch_camp_result: (data: any) => handleSwitchCampResult(data)
};
/**
 * 处理服务器发来的指令
 */
const handleMessage = (instructObj: InstructObject) => {
  const { type, class: class_, conveyor, data } = instructObj;
  const key = class_ ? `${type}_${class_}` : type;// 生成指令键名
  const handler = instructionHandlers[key as keyof typeof instructionHandlers];
  if (handler) {
    if (class_) {
      (handler as (conveyor: any, data: any) => void)(conveyor, data);
    } else {
      (handler as (data?: any) => void)(data);
    }
  } else {
    console.warn(`收到来自服务器的未知指令: ${key}`);
  }
};

// ==============================
// 消息处理函数
// ==============================
/**
 * 处理收到投票发起
 */
const handleSwitchCampPoll = (data: any) => {
  const { pollConveyor, timeout } = data;
  // 设置投票相关状态
  pollCountM1.value += 1;
  pollConveyorM1.value = pollConveyor;
  pollCountdownM1.value = timeout;
  
  // 开启投票倒计时
  if (intervalPollM1.value) {
    clearInterval(intervalPollM1.value);
  }
  
  intervalPollM1.value = setInterval(() => {
    if (pollCountdownM1.value > 0) {
      pollCountdownM1.value -= 1;
    } else {
      clearInterval(intervalPollM1.value);
      // 超时后清理状态
      pollCountdownM1.value = 0;
    }
  }, 1000);
  
  // 显示投票通知
  const starterName = pollConveyor.split('&')[0];
  alertMessage({
    type: 'simple',
    text: `${starterName}发起了换边投票，请在${timeout}秒内投票`
  });
};

/**
 * 处理交换阵营结果
 */
const handleSwitchCampResult = (data: any) => {
  const { result, total, agree, disagree } = data;
  
  resultCountM1.value += 1;
  pollResultM1.value = result;
  voteTotalM1.value = total;
  voteAgreeM1.value = agree;
  voteDisagreeM1.value = disagree;
  
  // 清理投票倒计时
  if (intervalPollM1.value) {
    clearInterval(intervalPollM1.value);
    pollCountdownM1.value = 0;
  }
  
  // 显示结果通知
  let resultText = '';
  switch (result) {
    case 'all_pass':
      resultText = '换边投票通过，阵营已交换';
      playerManager.forceRefreshPlayerNameTags();// 换边通过后，强制清理所有玩家的nameTag
      break;
    case 'partly_pass':
      resultText = `换边投票部分通过 (${agree}/${total} 同意)`;
      break;
    case 'timeout':
      resultText = '换边投票超时';
      break;
    case 'shorthanded':
      resultText = '参与投票人数不足';
      break;
  }
  
  alertMessage({
    type: 'simple',
    text: resultText
  });
};

/**
 * 处理发送投票
 */
const handleSendVote = (status: boolean) => {
  // 检查是否有进行中的投票
  if (pollCountdownM1.value <= 0) {
    alertMessage({ type: 'simple', text: '没有进行中的投票' });
    return;
  }

  // 发送投票
  ccInstruct.switchCampVote('', status);
  
  const voteText = status ? '同意' : '反对';
  alertMessage({
    type: 'simple',
    text: `已投票：${voteText}`
  });
};

/**
 * 处理选阵营结果
 */
const handleSelectCampRed = () => {
  campMyChoiceC1.value = 'red';
  playerManager.setMyCamp('red');
  firstPersonController.setCameraPosition(//修改相机位置
    cameraConfig.redStartPos,
    cameraConfig.redStartPitch,
    cameraConfig.redStartYaw
  );
  // 上传新的初始位置
  setTimeout(() => {
    const position = firstPersonController.getPosition();
    ccInstruct.broadcastHeadPositionPitchYaw(
      '',
      position,
      firstPersonController.pitch,
      firstPersonController.yaw,
      campMyChoiceC1.value
    );
  }, 0);
  playerManager.updatePlayerHeadVisibility();
};
const handleSelectCampBlack = () => {
  campMyChoiceC1.value = 'black';
  playerManager.setMyCamp('black');
  firstPersonController.setCameraPosition(//修改相机位置
    cameraConfig.blackStartPos,
    cameraConfig.blackStartPitch,
    cameraConfig.blackStartYaw
  );
  // 上传新的初始位置
  setTimeout(() => {
    const position = firstPersonController.getPosition();
    ccInstruct.broadcastHeadPositionPitchYaw(
      '',
      position,
      firstPersonController.pitch,
      firstPersonController.yaw,
      campMyChoiceC1.value
    );
  }, 0);
  playerManager.updatePlayerHeadVisibility();
};

/**
 * 服务器返回点赞事件处理
 */
const handleHeartTk = () => {
  if (heartRef.value) {
    heartRef.value.setLiked(true);
  }
}

const handleRbHeadPositionPitchYaw = (data: any) => {
  const { red, black } = data;
  if(sceneManager.loadedPlayerHeadsCount<2){
    pendingRbHeadData.value=data;
    return;
  }
  if(red.conveyor !== ''){
    playerManager.updatePlayerData(red.conveyor,{position: red.position, pitch: red.pitch, yaw: red.yaw, camp: 'red'});
    playerManager.updatePlayerHeadModel(red.conveyor,red.position,red.pitch,red.yaw,'red');
    setTimeout(()=>playerManager.updatePlayerHeadVisibility(),0);
  }
  if(black.conveyor !== ''){
    playerManager.updatePlayerData(black.conveyor,{position: black.position, pitch: black.pitch, yaw: black.yaw, camp: 'black'});
    playerManager.updatePlayerHeadModel(black.conveyor,black.position,black.pitch,black.yaw,'black');
    setTimeout(()=>playerManager.updatePlayerHeadVisibility(),0);
  }
};

/**
 * 普通消息事件
 */
const handleBroadcastSpMessage = (conveyor: string, data: any) =>{
  const { text } = data;
  messagesSpC1.value.push(
    {
      "id":messageCountSpC1.value,
      "conveyor":conveyor,
      "text":text
    }
  );
  messageCountSpC1.value += 1;
};

/**
 * 响应请求和棋事件
 */
const handleBroadcastResponseDraw = (conveyor: string, data: boolean) =>{
  responseDrawCounterC1.value += 1;
  responseDrawConveyorC1.value = conveyor;
  responseDrawStatusC1.value = data;
};

/**
 * 响应请求和棋事件
 */
const handleBroadcastRequestDraw = (conveyor: string, data:any) =>{
  responseDrawConveyorC1.value = '';
  responseDrawStatusC1.value = false;
  requestDrawCounterC1.value += 1;
  requestDrawConveyorC1.value = conveyor;
};

/**
 * 服务器返回玩家加入和退出游戏事件处理
 */
const handleBroadcastUserJoinGame = (conveyor: string, data: any) => {
  const userName = conveyor.split('&')[0]; // 从conveyor中提取用户名
  const userEmail = conveyor.split('&')[1]; // 从conveyor中提取用户名
  alertMessage({type:'join',name:userName,email:userEmail});
  playerManager.updatePlayerHeadVisibility();// 更新头部模型可见性
};
const handleBroadcastUserLeftGame = (conveyor: string, data: any) => {
  const userName = conveyor.split('&')[0]; // 从conveyor中提取用户名
  const userEmail = conveyor.split('&')[1]; // 从conveyor中提取用户名
  playerManager.removePlayer(conveyor);// 从玩家头部数据中移除该玩家
  alertMessage({type:'left',name:userName,email:userEmail});// 显示离开通知
  playerManager.updatePlayerHeadVisibility();// 更新头部模型可见性
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
 * 处理广播的重置所有棋子指令
 */
const handleBroadcastResetAllChessPieces = (conveyor: string, data: any) => {
  // 清除所有移动箭头
  moveArrowManager.removeAllArrowGroups();
  
  // 重置所有棋子状态（原有逻辑）
  chessPieceManager.resetAllPieces();
  
  resetChessCountC1.value += 1;
  resetChessConveyorC1.value = conveyor;
  giveUpConveyorC1.value = '';
};

/**
 * 处理广播的移动中棋子指令
 */
const handleBroadcastMovingChess = (conveyor: string, data: any) => {
  const { piece_name, trajectory } = data;
  
  if (trajectory && trajectory.length > 0) {
    const latestPosition = trajectory[trajectory.length - 1];
    
    // 更新棋子状态
    chessPieceManager.updatePieceState(
      piece_name,
      {
        isPicked: true,
        pickedBy: conveyor,
        position: latestPosition
      }
    );
    
    // 在场景中更新棋子位置
    const piece = chessPieceManager.getPieceByName(piece_name);
    if (piece) {
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
        chessPieceManager.addTrajectory(
          piece_name,
          smoothTrajectory,
          gameTick * (smoothTrajectory.length - 1)
        );
  
      } else {
        // 只有一个点，直接设置位置
        piece.position.set(latestPosition.x, latestPosition.y, latestPosition.z);
      }
    }
  }
};

const handleCampData = (data: any) => {
  campDataC1.value = {
    red: { id: data.red.id, name: data.red.name, email: data.red.email },
    black: { id: data.black.id, name: data.black.name, email: data.black.email }
  };
  if(playerManager){
    playerManager.setCampData(campDataC1.value);
    playerManager.updatePlayerHeadVisibility();
  }
  else{
    pendingCampData.value = campDataC1.value;
  }
};

const handleSyncChessPieces = (data: any) => {
  const { pieces } = data;
  if (chessPieceManager.allPieceLoadedState) {
    if (pieces && Array.isArray(pieces)) {
      chessPieceManager.syncPieces(pieces);
    }
  }else{
    pendingPiecesData.value = data;
  }
};

const handleBroadcastPickUpChess = (conveyor: string, data: any) => {
  const { piece_name, position } = data;
  
  chessPieceManager.updateMoveHistory(piece_name, conveyor, position);
  chessPieceManager.updatePieceState(piece_name, {
    isPicked: true,
    pickedBy: conveyor,
    position: position
  });
  
  const piece = chessPieceManager.getPieceByName(piece_name);
  if (piece) {
    piece.position.set(position.x, position.y, position.z);
    chessPieceManager.setPieceAsPickedByOther(piece);
  }
};

const handleBroadcastPickDownChess = (conveyor: string, data: any) => {
  const { piece_name, position } = data;
  
  const moveHistory = chessPieceManager.getMoveHistory(piece_name);
  if (moveHistory && moveHistory.lastPickUpPosition && moveHistory.lastPickUpBy === conveyor) {
    const startPos = moveHistory.lastPickUpPosition;
    const endPos = position;
    
    let playerCamp = 'unknown';
    const playerData = playerManager.getPlayer(conveyor);
    if (playerData) {
      playerCamp = playerData.camp;
    }
    
    moveArrowManager.removeAllArrowGroups();
    moveArrowManager.addMoveArrow(startPos, endPos, playerCamp, piece_name);
    
    moveHistory.lastPickUpPosition = null;
  }
  
  chessPieceManager.updatePieceState(piece_name, {
    isPicked: false,
    pickedBy: '',
    position: position
  });
  
  const piece = chessPieceManager.getPieceByName(piece_name);
  if (piece) {
    chessPieceManager.restorePieceState(piece);
    piece.position.set(position.x, position.y, position.z);
  }
};

const handleBroadcastHeadPositionPitchYaw = (conveyor: string, data: any) => {
  const { position, pitch, yaw, camp } = data;
  playerManager.updatePlayerData(conveyor, { position, pitch, yaw, camp });
};

/**
 * 处理点赞事件
 */
const handleHeart3=()=>{
  ccInstruct.heart3();
};

/**
 * 处理发送请求和棋事件
 */
const handleSendRequestDraw = () => {
  ccInstruct.broadcastRequestDraw('');
  alertMessage({type:'simple',text:'已发起和棋请求'});
};

const handleSendSwitchCampPoll = (value:boolean) => {
  if(pollCountdownM1.value !== 0){
    alertMessage({type:'simple',text:'请等待投票完成结算'});
    return;
  }
  if(value){
    ccInstruct.switchCampPoll('',pollTimeM1);
    pollCountdownM1.value = pollTimeM1;
    intervalPollM1.value = setInterval(()=>{
      if(pollCountdownM1.value!==0){pollCountdownM1.value-=1;}
      else{clearInterval(intervalPollM1.value);}
    },1000);
    alertMessage({type:'simple',text:'已发起换边投票'});
  }
  else{
    alertMessage({type:'simple',text:'无法发起换边投票(非阵营双方)'});
  }
};

// ==============================
// 游戏功能函数
// ==============================

/**
 * 添加通知信息
 */
const alertMessage = (content:NotifyUserLineChange|NotifySimple) => {
  const notification = {id: notificationIdCounter++,timestamp: Date.now(),content};
  notificationArr.value.push(notification);
  setTimeout(() => {
    const index = notificationArr.value.findIndex(notif => notif.id === notification.id);
    if(index!==-1)notificationArr.value.splice(index,1);
  }, 5000);
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

// 选择阵营开始游戏
const clickStartGame = (side: 'red' | 'black') => {
  if (side === 'red') {
    firstPersonController.setCameraPosition(//修改相机位置
      cameraConfig.redStartPos,
      cameraConfig.redStartPitch,
      cameraConfig.redStartYaw
    );
    if(side !== campMyChoiceC1.value ){
      ccInstruct.getSelectCampRed();
    }
  } else {
    firstPersonController.setCameraPosition(//修改相机位置
      cameraConfig.blackStartPos,
      cameraConfig.blackStartPitch,
      cameraConfig.blackStartYaw
    );
    if(side !== campMyChoiceC1.value ){
      ccInstruct.getSelectCampBlack();
    }
  }
  
  campMyChoiceC1.value = side;
  playerManager.setMyCamp(side);

  // 上传新的初始位置
  setTimeout(() => {
    const position = firstPersonController.getPosition();
    ccInstruct.broadcastHeadPositionPitchYaw(
      '',
      position,
      firstPersonController.pitch,
      firstPersonController.yaw,
      campMyChoiceC1.value
    );
  }, 0);
  
  applyGameSettings();
  playerManager.updatePlayerHeadVisibility();
};

// 应用游戏设置
const applyGameSettings = () => {
  const settings = gameSettingStore.gameSettings;
  
  if (sceneManager.camera) {
    sceneManager.camera.fov = settings.fov;
    sceneManager.camera.updateProjectionMatrix();
  }
  
  if (sceneManager.ambientLight) {
    sceneManager.ambientLight.intensity = settings.ambientIntensity;
  }
  
  firstPersonController.updateGameSettings(settings);
};

// ==============================
// 动画循环
// ==============================
let prevTime = performance.now();
const animate = () => {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  prevTime = time;
  
  // 更新第一人称控制器
  firstPersonController.update(delta);
  
  // 更新棋子跟随
  chessInteractionManager.updatePieceFollowing(gameTick);
  
  // 更新棋子轨迹
  chessPieceManager.updateTrajectories(delta);
  
  // 平滑更新玩家头部
  playerManager.smoothUpdatePlayerHeads(delta);
  
  // 定期广播头部位置
  if (time % gameTick < delta * 1000) {
    if (campMyChoiceC1.value === 'red' || campMyChoiceC1.value === 'black') {
      if (firstPersonController.isPointerLocked) {
        const position = firstPersonController.getPosition();
        ccInstruct.broadcastHeadPositionPitchYaw(
          '',
          position,
          firstPersonController.pitch,
          firstPersonController.yaw,
          campMyChoiceC1.value
        );
      }
    }
  }
  
  // 渲染场景
  sceneManager.render();
};

// ==============================
// 生命周期
// ==============================
onMounted(async () => {
  if (!sceneRef.value) return;
  
  // 初始化指令处理器
  initInstructionHandlers();

  // 初始化场景管理器
  sceneManager = new ChessSceneManager(
    sceneRef.value,
    (increment, status) => {
      loadingState.value.loadedResources += increment;
      const progress = (loadingState.value.loadedResources / loadingState.value.totalResources) * 100;
      loadingState.value.progress = Math.min(100, progress);
    
      if (status) {
        loadingState.value.statusText = status;
      }
    
      if (loadingState.value.loadedResources >= loadingState.value.totalResources) {
        setTimeout(() => {
          loadingState.value.isLoading = false;
          loadingState.value.statusText = '场景加载完成！';
        }, 500);
      }
    },
    (head1, head2) => {// 所有玩家头部模型加载完成回调
      playerManager.setPlayerHeads(head1, head2);
      const { red, black } = pendingRbHeadData.value || {'red':{conveyor:'',position:{x:0,y:0,z:0},pitch:0,yaw:0},'black':{conveyor:'',position:{x:0,y:0,z:0},pitch:0,yaw:0}};
      if(red.conveyor !== ''){
        playerManager.updatePlayerData(red.conveyor,{position: red.position, pitch: red.pitch, yaw: red.yaw, camp: 'red'});
        playerManager.updatePlayerHeadModel(red.conveyor,red.position,red.pitch,red.yaw,'red');
        setTimeout(()=>playerManager.updatePlayerHeadVisibility(),0);
      }
      if(black.conveyor !== ''){
        playerManager.updatePlayerData(black.conveyor,{position: black.position, pitch: black.pitch, yaw: black.yaw, camp: 'black'});
        playerManager.updatePlayerHeadModel(black.conveyor,black.position,black.pitch,black.yaw,'black');
        setTimeout(()=>playerManager.updatePlayerHeadVisibility(),0);
      }
    }
  );
  sceneManager.init();
  
  // 初始化玩家管理器
  playerManager = new ChessPlayerManager(
    sceneManager.scene,
    campDataC1.value,
    ()=>{
      if (pendingCampData.value) {
        playerManager.setCampData(pendingCampData.value);
        playerManager.updatePlayerHeadVisibility();
        pendingCampData.value = null;
      }
    }
  );

  // 初始化棋子管理器
  chessPieceManager = new ChessPieceManager(
    sceneManager.scene,
    (increment, status) => {
      // 更新加载进度
    },
    (pieceName, piece) => {
     // 单个棋子加载完成回调 
    },
    () => {
      // 所有棋子加载完成回调
      if (pendingPiecesData.value) {
        const { pieces } = pendingPiecesData.value;
        if (pieces && Array.isArray(pieces)) {
          chessPieceManager.syncPieces(pieces);
        }
        pendingPiecesData.value = null;
      }
    }
  );
  await chessPieceManager.createChessPieces();

  // 初始化棋子交互管理器
  chessInteractionManager = new ChessInteractionManager(
    sceneManager.scene,
    sceneManager.camera,
    chessPieceManager,
    (pieceName, position) => {
      ccInstruct.broadcastPickUpChess('', pieceName, position);
    },
    (pieceName, position) => {
      ccInstruct.broadcastPickDownChess('', pieceName, position);
    },
    (pieceName, trajectory) => {
      ccInstruct.broadcastMovingChess('', pieceName, trajectory);
    },
    (pieceName) => {
      const state = chessPieceManager.getPieceState(pieceName);
      return !!(state && state.isPicked && state.pickedBy);
    }
  );

  // 初始化第一人称控制器
  firstPersonController = new FirstPersonController(
    sceneManager.camera,
    sceneManager.renderer.domElement,
    gameSettingStore.gameSettings,
    () => chessInteractionManager.onClick()
  );
  firstPersonController.init();
  
  // 初始化移动箭头管理器
  moveArrowManager = new ChessMoveArrowManager(sceneManager.scene);
  
  // 开始动画循环
  animate();
  
  // 窗口大小调整监听
  window.addEventListener('resize', () => sceneManager.resize());
});

onUnmounted(() => {
  // 清理所有管理器
  moveArrowManager?.removeAllArrowGroups();
  chessInteractionManager?.resetPickingState();
  firstPersonController?.dispose();
  playerManager?.dispose();
  sceneManager?.dispose();
  
  // 移除事件监听器
  window.removeEventListener('resize', () => sceneManager?.resize());
});
</script>

<template>
  <div class="pageBox">
    <div ref="sceneRef" class="chess-container"></div>
    <div class="crosshair"></div>


    <!-- 投票组件 -->
    <div v-if="pollCountdownM1 > 0" class="voting-overlay">
      <div class="voting-panel">
        <h3>换边投票</h3>
        <p>发起者: {{ pollConveyorM1.split('&')[0] }}</p>
        <p>剩余时间: {{ pollCountdownM1 }}秒</p>
        <div class="voting-buttons">
          <button @click="handleSendVote(true)" class="agree-btn">同意换边</button>
          <button @click="handleSendVote(false)" class="disagree-btn">反对换边</button>
        </div>
      </div>
    </div>
    
    <!-- 显示投票结果的组件 -->
    <ViewCC1SwitchCampResult 
      :poll-count="pollCountM1"
      :poll-conveyor="pollConveyorM1"
      :result-count="resultCountM1"
      :poll-result="pollResultM1"
      :vote-total="voteTotalM1"
      :vote-agree="voteAgreeM1"
      :vote-disagree="voteDisagreeM1"
    />


    <ViewCC1DebugInfo :enabled-debug="debugEnabled" :debug-info="debugInfoC1"/>
    <ViewUserLayer theme="light" design="C" @click-logout="ccInstruct.closeLink()"/>
    <ViewHeart ref="heartRef" @like-change="handleHeart3" label="Like" />
    <ViewCC1Menu @click-open-menu="showStartMenu" :open-menu-state="false" :top="80" :left="20"/>
    <ViewCC1GiveUp :give-up-state="giveUpStateC1" @click-give-up="showGiveUpConfirm"/>
    <ViewCC1ResetChess :give-up-state="giveUpStateC1" :give-up-conveyor="giveUpConveyorC1" 
      @click-reset-chess="ccInstruct.broadcastResetAllChessPieces('')"/>
    <ViewCC1GiveUpConfirm ref="giveUpConfirmRef" :give-up-state="giveUpStateC1" 
      @confirm-give-up="ccInstruct.broadcastGiveUp('')"/>
    <ViewCC1GiveUpResult :give-up-state="giveUpStateC1" :give-up-conveyor="giveUpConveyorC1" 
      @click-reset-chess="ccInstruct.broadcastResetAllChessPieces('')"/>
    <ViewCC1ResetChessResult :reset-chess-count="resetChessCountC1" :reset-chess-conveyor="resetChessConveyorC1"/>
    <ViewCC1RequestDraw @click-request-draw="handleSendRequestDraw"/>
    <ViewCC1ResponDraw @agree-draw="ccInstruct.broadcastResponseDraw('',true)" 
      @reject-draw="ccInstruct.broadcastResponseDraw('',false)" 
      :request-draw-counter="requestDrawCounterC1" :request-draw-conveyor="requestDrawConveyorC1" 
      :response-draw-counter="responseDrawCounterC1" :response-draw-conveyor="responseDrawConveyorC1" 
      :response-draw-status="responseDrawStatusC1"/>
    <ViewCC1SwitchCamp @click-switch-camp-poll="handleSendSwitchCampPoll" :camp-data="campDataC1"/>
    <ViewCC1SwitchCampResult :poll-count="pollCountM1" :poll-conveyor="pollConveyorM1" 
      :result-count="resultCountM1" :poll-result="pollResultM1" 
      :vote-total="voteTotalM1" :vote-agree="voteAgreeM1" :vote-disagree="voteDisagreeM1"/>
    <ViewCC1Notifications :notifications="notificationArr"/>
    <ViewCC1Message @click-send-message-sp="(text)=>ccInstruct.broadcastSpMessage('',text)" 
      :messages-sp="messagesSpC1" :message-count-sp="messageCountSpC1"/>
    <PartCC1StartMenu ref="startMenuRef" :camp-data="campDataC1" :selected-camp="campMyChoiceC1" 
      @start-game="clickStartGame" @change-setting="applyGameSettings"/>
    <PartCC1Loading :loading-state="loadingState"/>
    <PartCC1Check/>
  </div>
</template>

<style scoped>




.voting-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 10px;
  z-index: 1000;
  color: white;
}

.voting-panel {
  text-align: center;
}

.voting-buttons {
  margin-top: 15px;
}

.voting-buttons button {
  margin: 0 10px;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.agree-btn {
  background-color: #4CAF50;
  color: white;
}

.disagree-btn {
  background-color: #f44336;
  color: white;
}





.chess-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  z-index: 10;
  top: 0;
  left: 0;
  overflow: hidden;
}

.pageBox {
  width: 100vw;
  height: 100vh;
}

.crosshair {
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

.chess-container:fullscreen,
.chess-container:-webkit-full-screen,
.chess-container:-moz-full-screen {
  /* 保留全屏时的光标隐藏 */
  cursor: none;
}
</style>