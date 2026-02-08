// The relative position of this file: src/class/collision_detection_test/Octree.ts
// Code name:CDT1
import type Coord3D from "@/interface/Coord3D"
import type Rotation3D from "@/interface/Rotation3D"
import type Coord2D from "@/interface/Coord2D"
import type Line2D from "@/interface/Line2D"


interface Segment {
    id: number;
    start: Coord2D;
    end: Coord2D;
}

// 简单的AVL树实现用于维护状态
class AVLNode {
    segment: Segment;
    height: number;
    left: AVLNode | null;
    right: AVLNode | null;
    parent: AVLNode | null;

    constructor(segment: Segment) {
        this.segment = segment;
        this.height = 1;
        this.left = null;
        this.right = null;
        this.parent = null;
    }
}

class AVLTree {
    private root: AVLNode | null = null;
    private currentX: number = 0;

    setCurrentX(x: number): void {
        this.currentX = x;
    }

    private getHeight(node: AVLNode | null): number {
        return node ? node.height : 0;
    }

    private getYAtX(segment: Segment): number {
        if (Math.abs(segment.end.x - segment.start.x) < 1e-10) {
            return segment.start.y;
        }
        const slope = (segment.end.y - segment.start.y) / (segment.end.x - segment.start.x);
        return segment.start.y + slope * (this.currentX - segment.start.x);
    }

    private compareSegments(seg1: Segment, seg2: Segment): number {
        const y1 = this.getYAtX(seg1);
        const y2 = this.getYAtX(seg2);
        
        if (Math.abs(y1 - y2) < 1e-10) {
            // 如果y坐标相同，比较斜率
            const slope1 = (seg1.end.y - seg1.start.y) / (seg1.end.x - seg1.start.x);
            const slope2 = (seg2.end.y - seg2.start.y) / (seg2.end.x - seg2.start.x);
            return slope1 - slope2;
        }
        return y1 - y2;
    }

    insert(segment: Segment): void {
        this.root = this.insertNode(this.root, segment);
    }

    private insertNode(node: AVLNode | null, segment: Segment): AVLNode {
        if (!node) {
            return new AVLNode(segment);
        }

        const comparison = this.compareSegments(segment, node.segment);
        
        if (comparison < 0) {
            node.left = this.insertNode(node.left, segment);
            node.left.parent = node;
        } else if (comparison > 0) {
            node.right = this.insertNode(node.right, segment);
            node.right.parent = node;
        } else {
            return node; // 相等的情况
        }

        // 更新高度
        node.height = 1 + Math.max(
            this.getHeight(node.left),
            this.getHeight(node.right)
        );

        // 平衡因子
        const balance = this.getHeight(node.left) - this.getHeight(node.right);

        // 平衡操作
        if (balance > 1) {
            if (this.compareSegments(segment, node.left!.segment) < 0) {
                return this.rightRotate(node);
            } else {
                node.left = this.leftRotate(node.left!);
                return this.rightRotate(node);
            }
        }

        if (balance < -1) {
            if (this.compareSegments(segment, node.right!.segment) > 0) {
                return this.leftRotate(node);
            } else {
                node.right = this.rightRotate(node.right!);
                return this.leftRotate(node);
            }
        }

        return node;
    }

    private leftRotate(z: AVLNode): AVLNode {
        const y = z.right!;
        const T2 = y.left;

        y.left = z;
        z.right = T2;

        if (T2) T2.parent = z;
        y.parent = z.parent;
        z.parent = y;

        z.height = 1 + Math.max(
            this.getHeight(z.left),
            this.getHeight(z.right)
        );
        y.height = 1 + Math.max(
            this.getHeight(y.left),
            this.getHeight(y.right)
        );

        return y;
    }

    private rightRotate(z: AVLNode): AVLNode {
        const y = z.left!;
        const T3 = y.right;

        y.right = z;
        z.left = T3;

        if (T3) T3.parent = z;
        y.parent = z.parent;
        z.parent = y;

        z.height = 1 + Math.max(
            this.getHeight(z.left),
            this.getHeight(z.right)
        );
        y.height = 1 + Math.max(
            this.getHeight(y.left),
            this.getHeight(y.right)
        );

        return y;
    }

    // 获取中序遍历（按y坐标排序）
    inOrder(): Segment[] {
        const result: Segment[] = [];
        this.inOrderTraversal(this.root, result);
        return result;
    }

    private inOrderTraversal(node: AVLNode | null, result: Segment[]): void {
        if (node) {
            this.inOrderTraversal(node.left, result);
            result.push(node.segment);
            this.inOrderTraversal(node.right, result);
        }
    }

    // 查找线段的前驱和后继
    findNeighbors(segment: Segment): { predecessor: Segment | null, successor: Segment | null } {
        const neighbors = { predecessor: null as Segment | null, successor: null as Segment | null };
        this.findNeighborsRecursive(this.root, segment, neighbors);
        return neighbors;
    }

    private findNeighborsRecursive(
        node: AVLNode | null, 
        segment: Segment, 
        neighbors: { predecessor: Segment | null, successor: Segment | null }
    ): void {
        if (!node) return;

        const comparison = this.compareSegments(segment, node.segment);

        if (comparison < 0) {
            neighbors.successor = node.segment;
            this.findNeighborsRecursive(node.left, segment, neighbors);
        } else if (comparison > 0) {
            neighbors.predecessor = node.segment;
            this.findNeighborsRecursive(node.right, segment, neighbors);
        } else {
            // 找到当前节点
            if (node.left) {
                let current = node.left;
                while (current.right) {
                    current = current.right;
                }
                neighbors.predecessor = current.segment;
            }
            if (node.right) {
                let current = node.right;
                while (current.left) {
                    current = current.left;
                }
                neighbors.successor = current.segment;
            }
        }
    }
}




// define interface
interface Object3D {
    oId:number,// object id
    oName:string,// object name
    sourceNodes:Array<Coord3D>,// full nodes 
    sourceRotation:Rotation3D,// obj routation
    sourceP1:Coord3D,// min x ,min y, min z first compute
    sourceP2:Coord3D,// max x ,max y, max z first compute
    sourceP3:Coord3D,// center x ,center y ,center z
    offset:Coord3D,// move offset
    rotation:Rotation3D// move rotation
}

interface Group3D {
    gId:number,// group id
    gName:string,// group name
    objects:Array<Object3D>,
    children:Group3D
}

interface P123 {
    P1:Coord3D,
    P2:Coord3D,
    P3:Coord3D
}

interface OC {
    
}


export default class Octree {

    constructor(){

    }


    /**********************************
     * TEST AREA START ↓ ↓ ↓ ↓
     **********************************/

    /**
     * 慢速凸包算法实现
     * 返回顺时针方向的凸包顶点列表
     */
    public slowConvexHull(P: Coord2D[]): Coord2D[] {
      // 如果点少于3个，直接返回所有点（退化情况）
      if (P.length <= 3) {
        return P;
      }

      let E: Line2D[] = [];
      const Len = P.length;
      const epsilon = 1e-10; // 浮点数精度容差

      // 遍历所有有序对 (p, q)
      for (let i = 0; i < Len; i++) {
        const p = P[i];
        
        for (let j = 0; j < Len; j++) {
          if (i !== j) {
            const q = P[j];
            let valid = true;
            
            // 检查所有其他点 r
            for (let k = 0; k < Len; k++) {
              if (k !== i && k !== j) {
                const r = P[k];
                const position = this.pointRelativeToLine(p, q, r, epsilon);
                
                // 如果任何点在直线左侧，该边无效
                if (position === -1) {
                  valid = false;
                  break;
                }
              }
            }
            
            if (valid) {
              E.push({ start: p, end: q });
            }
          }
        }
      }

      // 从边集 E 中提取顶点并排序
      return this.buildConvexHullFromEdges(E);
    }

    /**
     * 从边集构建凸包并顺时针排序顶点
     */
    private buildConvexHullFromEdges(E: Line2D[]): Coord2D[] {
      if (E.length === 0) return [];
      
      // 1. 收集所有顶点
      const vertexMap = new Map<string, Coord2D>();
      for (const edge of E) {
        vertexMap.set(this.coordToString(edge.start), edge.start);
        vertexMap.set(this.coordToString(edge.end), edge.end);
      }
      
      const vertices = Array.from(vertexMap.values());
      
      // 2. 计算几何中心（用于角度排序）
      const center = this.calculateCentroid(vertices);
      
      // 3. 按相对于中心的极角排序（顺时针）
      vertices.sort((a, b) => {
        const angleA = Math.atan2(a.y - center.y, a.x - center.x);
        const angleB = Math.atan2(b.y - center.y, b.x - center.x);
        
        // 转换为顺时针排序（atan2默认返回[-π, π]，逆时针增加）
        // 顺时针需要角度递减
        return angleB - angleA;
      });
      
      return vertices;
    }

    /**
     * 计算多边形的几何中心（质心）
     */
    private calculateCentroid(vertices: Coord2D[]): Coord2D {
      let sumX = 0;
      let sumY = 0;
      
      for (const vertex of vertices) {
        sumX += vertex.x;
        sumY += vertex.y;
      }
      
      return {
        x: sumX / vertices.length,
        y: sumY / vertices.length
      };
    }

    /**
     * 判断点 X 相对于直线 PQ 的位置
     * @param p 点 P 的坐标
     * @param q 点 Q 的坐标
     * @param x 点 X 的坐标
     * @param epsilon 浮点数精度容差
     * @returns 
     *   -1: 点 X 在直线 PQ 的左侧
     *    0: 点 X 在直线 PQ 上（或非常接近）
     *    1: 点 X 在直线 PQ 的右侧
     */
    private pointRelativeToLine(
      p: Coord2D, 
      q: Coord2D, 
      x: Coord2D, 
      epsilon: number = 1e-10
    ): number {
      // 计算向量叉积：(Q - P) × (X - P)
      const crossProduct = (q.x - p.x) * (x.y - p.y) - (q.y - p.y) * (x.x - p.x);
      
      // 使用 epsilon 处理浮点数精度问题
      if (Math.abs(crossProduct) < epsilon) {
        return 0;  // 点在直线上
      }
      
      return crossProduct > 0 ? 1 : -1;  // 注意：这里的方向定义
    }

    /**
     * 将坐标转换为字符串键
     */
    private coordToString(coord: Coord2D): string {
      return `${coord.x.toFixed(8)},${coord.y.toFixed(8)}`; // 使用固定精度避免浮点误差
    }


    /**********************************
     * TEST AREA END ↑ ↑ ↑ ↑
     **********************************/



    // 模拟 Object3D 对象
    private testObj3d1:Object3D = {
        oId:1,
        oName:"test1",
        sourceNodes:[
            {x:0,y:0,z:0},
            {x:0,y:0,z:1},
            {x:0,y:1,z:1},
            {x:1,y:1,z:1}
        ],
        sourceRotation:{
            yaw:0,
            pitch:0,
            roll:0
        },
        sourceP1:{
            x:0,y:0,z:0
        },
        sourceP2:{
            x:0,y:0,z:0
        },
        sourceP3:{
            x:0,y:0,z:0
        },
        offset:{
            x:0,y:0,z:0
        },
        rotation:{
            yaw:0,pitch:0,roll:0
        }
    }

    // 添加更多模拟对象
    private testObj3d2:Object3D = {
        oId:2,
        oName:"test2",
        sourceNodes:[
            {x:2,y:2,z:2},
            {x:2,y:2,z:3},
            {x:2,y:3,z:3},
            {x:3,y:3,z:3},
            {x:1,y:1,z:1} // 添加一个更小的点以测试边界
        ],
        sourceRotation:{
            yaw:0,
            pitch:0,
            roll:0
        },
        sourceP1:{
            x:0,y:0,z:0
        },
        sourceP2:{
            x:0,y:0,z:0
        },
        sourceP3:{
            x:0,y:0,z:0
        },
        offset:{
            x:1,y:1,z:1
        },
        rotation:{
            yaw:0,pitch:0,roll:0
        }
    }

    private testObj3d3:Object3D = {
        oId:3,
        oName:"test3",
        sourceNodes:[
            {x:-1,y:-1,z:-1},
            {x:0,y:0,z:0},
            {x:1,y:1,z:1},
            {x:2,y:2,z:2}
        ],
        sourceRotation:{
            yaw:45,
            pitch:30,
            roll:15
        },
        sourceP1:{
            x:0,y:0,z:0
        },
        sourceP2:{
            x:0,y:0,z:0
        },
        sourceP3:{
            x:0,y:0,z:0
        },
        offset:{
            x:0,y:0,z:0
        },
        rotation:{
            yaw:0,pitch:0,roll:0
        }
    }

    /**
     * 计算 P1, P2, P3
     * P1: 最小边界点 (minX, minY, minZ)
     * P2: 最大边界点 (maxX, maxY, maxZ)
     * P3: 中心点 ((minX+maxX)/2, (minY+maxY)/2, (minZ+maxZ)/2)
     */
    private computeP123(nodes:Array<Coord3D>) : P123{
        if (nodes.length === 0) {
            return {
                P1: {x:0, y:0, z:0},
                P2: {x:0, y:0, z:0},
                P3: {x:0, y:0, z:0}
            };
        }

        // 初始化最小和最大值
        let minX = nodes[0].x;
        let minY = nodes[0].y;
        let minZ = nodes[0].z;
        let maxX = nodes[0].x;
        let maxY = nodes[0].y;
        let maxZ = nodes[0].z;

        // 遍历所有节点找到最小和最大值
        for(let i = 1; i < nodes.length; i++){
            const node = nodes[i];
            
            if(node.x < minX) minX = node.x;
            if(node.y < minY) minY = node.y;
            if(node.z < minZ) minZ = node.z;
            
            if(node.x > maxX) maxX = node.x;
            if(node.y > maxY) maxY = node.y;
            if(node.z > maxZ) maxZ = node.z;
        }

        const P1:Coord3D = {x: minX, y: minY, z: minZ};
        const P2:Coord3D = {x: maxX, y: maxY, z: maxZ};
        const P3:Coord3D = {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            z: (minZ + maxZ) / 2
        };
        
        return {P1, P2, P3};   
    }

    /**
     * 初始化所有测试对象的边界框
     */
    public initializeTestObjects(): void {
        // 为每个测试对象计算并设置边界框
        const p123_1 = this.computeP123(this.testObj3d1.sourceNodes);
        this.testObj3d1.sourceP1 = p123_1.P1;
        this.testObj3d1.sourceP2 = p123_1.P2;
        this.testObj3d1.sourceP3 = p123_1.P3;

        const p123_2 = this.computeP123(this.testObj3d2.sourceNodes);
        this.testObj3d2.sourceP1 = p123_2.P1;
        this.testObj3d2.sourceP2 = p123_2.P2;
        this.testObj3d2.sourceP3 = p123_2.P3;

        const p123_3 = this.computeP123(this.testObj3d3.sourceNodes);
        this.testObj3d3.sourceP1 = p123_3.P1;
        this.testObj3d3.sourceP2 = p123_3.P2;
        this.testObj3d3.sourceP3 = p123_3.P3;
    }

    /**
     * 获取所有测试对象（用于验证）
     */
    public getTestObjects(): Array<Object3D> {
        return [this.testObj3d1, this.testObj3d2, this.testObj3d3];
    }

    /**
     * 打印测试对象信息
     */
    public printTestObjectsInfo(): void {
        console.log("Test Object 1:");
        console.log("  Source P1:", this.testObj3d1.sourceP1);
        console.log("  Source P2:", this.testObj3d1.sourceP2);
        console.log("  Source P3:", this.testObj3d1.sourceP3);
        
        console.log("Test Object 2:");
        console.log("  Source P1:", this.testObj3d2.sourceP1);
        console.log("  Source P2:", this.testObj3d2.sourceP2);
        console.log("  Source P3:", this.testObj3d2.sourceP3);
        
        console.log("Test Object 3:");
        console.log("  Source P1:", this.testObj3d3.sourceP1);
        console.log("  Source P2:", this.testObj3d3.sourceP2);
        console.log("  Source P3:", this.testObj3d3.sourceP3);
    }

 

    // threejs model object
    public  thereeModelObj={
  "metadata": {
    "version": 4.7,
    "type": "Object",
    "generator": "Object3D.toJSON"
  },
  "geometries": [
    {
      "uuid": "031a6249-7f82-466e-94ce-d623a1d7e474",
      "type": "BufferGeometry",
      "data": {
        "attributes": {
          "normal": {
            "isInterleavedBufferAttribute": true,
            "itemSize": 3,
            "data": "75975181-4e67-4281-82b8-af455b16738a",
            "offset": 3,
            "normalized": false
          },
          "position": {
            "isInterleavedBufferAttribute": true,
            "itemSize": 3,
            "data": "75975181-4e67-4281-82b8-af455b16738a",
            "offset": 0,
            "normalized": false
          },
          "uv": {
            "isInterleavedBufferAttribute": true,
            "itemSize": 2,
            "data": "75975181-4e67-4281-82b8-af455b16738a",
            "offset": 6,
            "normalized": false
          }
        },
        "index": {
          "type": "Uint32Array",
          "array": [
            0,
            1,
            2,
            2,
            3,
            0,
            4,
            5,
            6,
            6,
            7,
            4,
            8,
            9,
            10,
            10,
            11,
            8,
            12,
            13,
            14,
            14,
            15,
            12,
            16,
            17,
            18,
            18,
            19,
            16,
            20,
            21,
            22,
            22,
            23,
            20
          ]
        },
        "interleavedBuffers": {
          "75975181-4e67-4281-82b8-af455b16738a": {
            "uuid": "75975181-4e67-4281-82b8-af455b16738a",
            "buffer": "b0f42225-ecc4-4407-b533-1f9bb9c2810a",
            "type": "Float32Array",
            "stride": 8
          }
        },
        "arrayBuffers": {
          "b0f42225-ecc4-4407-b533-1f9bb9c2810a": [
            3291985155,
            3288341534,
            0,
            0,
            0,
            3212836864,
            1065353216,
            1065353216,
            3291985155,
            1140857886,
            0,
            0,
            0,
            3212836864,
            1065353216,
            0,
            1144501507,
            1140857886,
            0,
            0,
            0,
            3212836864,
            0,
            0,
            1144501507,
            3288341534,
            0,
            0,
            0,
            3212836864,
            0,
            1065353216,
            3291985155,
            3288341534,
            1159729019,
            0,
            0,
            1065353216,
            0,
            1065353216,
            1144501507,
            3288341534,
            1159729019,
            0,
            0,
            1065353216,
            1065353216,
            1065353216,
            1144501507,
            1140857886,
            1159729019,
            0,
            0,
            1065353216,
            1065353216,
            0,
            3291985155,
            1140857886,
            1159729019,
            0,
            0,
            1065353216,
            0,
            0,
            3291985155,
            3288341534,
            0,
            0,
            3212836864,
            0,
            0,
            1065353216,
            1144501507,
            3288341534,
            0,
            0,
            3212836864,
            0,
            1065353216,
            1065353216,
            1144501507,
            3288341534,
            1159729019,
            0,
            3212836864,
            0,
            1065353216,
            0,
            3291985155,
            3288341534,
            1159729019,
            0,
            3212836864,
            0,
            0,
            0,
            1144501507,
            3288341534,
            0,
            1065353216,
            0,
            0,
            0,
            1065353216,
            1144501507,
            1140857886,
            0,
            1065353216,
            0,
            0,
            1065353216,
            1065353216,
            1144501507,
            1140857886,
            1159729019,
            1065353216,
            0,
            0,
            1065353216,
            0,
            1144501507,
            3288341534,
            1159729019,
            1065353216,
            0,
            0,
            0,
            0,
            1144501507,
            1140857886,
            0,
            0,
            1065353216,
            0,
            0,
            1065353216,
            3291985155,
            1140857886,
            0,
            0,
            1065353216,
            0,
            1065353216,
            1065353216,
            3291985155,
            1140857886,
            1159729019,
            0,
            1065353216,
            0,
            1065353216,
            0,
            1144501507,
            1140857886,
            1159729019,
            0,
            1065353216,
            0,
            0,
            0,
            3291985155,
            1140857886,
            0,
            3212836864,
            0,
            0,
            0,
            1065353216,
            3291985155,
            3288341534,
            0,
            3212836864,
            0,
            0,
            1065353216,
            1065353216,
            3291985155,
            3288341534,
            1159729019,
            3212836864,
            0,
            0,
            1065353216,
            0,
            3291985155,
            1140857886,
            1159729019,
            3212836864,
            0,
            0,
            0,
            0
          ]
        },
        "boundingSphere": {
          "radius": 1562.7557012960012,
          "center": [
            0,
            0,
            1280.4837646484375
          ]
        }
      }
    }
  ],
  "materials": [
    {
      "uuid": "a1dd58a1-278d-46b2-85b8-b8dfa0832d58",
      "type": "MeshStandardMaterial",
      "name": "Material__27",
      "color": 12369084,
      "roughness": 0,
      "metalness": 0,
      "emissive": 0,
      "map": "6d2ce481-dab6-477c-acee-5ac5c8bf5a37",
      "envMapRotation": [
        0,
        0,
        0,
        "XYZ"
      ],
      "envMapIntensity": 1,
      "blendColor": 0
    }
  ],
  "textures": [
    {
      "uuid": "6d2ce481-dab6-477c-acee-5ac5c8bf5a37",
      "name": "texture_source0_sampler0",
      "image": "45cf534b-8264-4efd-a9a0-d5f8ca0bb9bd",
      "mapping": 300,
      "channel": 0,
      "repeat": [
        1,
        1
      ],
      "offset": [
        0,
        0
      ],
      "center": [
        0,
        0
      ],
      "rotation": 0,
      "wrap": [
        1000,
        1000
      ],
      "format": 1023,
      "internalFormat": null,
      "type": 1009,
      "colorSpace": "srgb",
      "minFilter": 1006,
      "magFilter": 1006,
      "anisotropy": 1,
      "flipY": false,
      "generateMipmaps": false,
      "premultiplyAlpha": false,
      "unpackAlignment": 4,
      "userData": {
        "mimeType": "image/jpeg"
      }
    }
  ],
  "images": [
    {
      "uuid": "45cf534b-8264-4efd-a9a0-d5f8ca0bb9bd",
      "url": "data:image/png;base64,iVBORw0KGgoA"
    }
  ],
  "object": {
    "uuid": "db100d10-7d2c-4dad-9aa5-7a0d996147a1",
    "type": "Group",
    "name": "test",
    "layers": 1,
    "matrix": [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      2,
      0,
      0,
      1
    ],
    "up": [
      0,
      1,
      0
    ],
    "children": [
      {
        "uuid": "a5a54356-bdc7-482f-97e5-9a656147914b",
        "type": "Object3D",
        "layers": 1,
        "matrix": [
          1,
          0,
          0,
          0,
          0,
          2.220446049250313e-16,
          -1,
          0,
          0,
          1,
          2.220446049250313e-16,
          0,
          -4.54147802734375,
          0.028152847290039064,
          -2.3386416015625002,
          1
        ],
        "up": [
          0,
          1,
          0
        ],
        "children": [
          {
            "uuid": "19f432cc-6fa3-4b29-8d85-e368d4859d05",
            "type": "Mesh",
            "name": "test",
            "castShadow": true,
            "receiveShadow": true,
            "userData": {
              "name": "test"
            },
            "layers": 1,
            "matrix": [
              0.001,
              0,
              0,
              0,
              0,
              0.001,
              0,
              0,
              0,
              0,
              0.001,
              0,
              0,
              0,
              0,
              1
            ],
            "up": [
              0,
              1,
              0
            ],
            "geometry": "031a6249-7f82-466e-94ce-d623a1d7e474",
            "material": "a1dd58a1-278d-46b2-85b8-b8dfa0832d58"
          }
        ]
      }
    ]
  }
}
}