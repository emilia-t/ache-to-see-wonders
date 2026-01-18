// The relative position of this file: src/class/collision_detection_test/Octree.ts
// Code name:CDT1
import type Coord3D from "@/interface/Coord3D"
import type Rotation3D from "@/interface/Rotation3D"
import type Coord2D from "@/interface/Coord2D"

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


    /**
     * TEST AREA START
     */

    //////计算任意平面点集的凸包节点 slowConvexHull(P) start
    
    public slowConvexHull(P:Array<Coord2D>):Array<Coord2D>{
      let E:Array<Coord2D> = []
      let Len = P.length;

      // 便利全部
      // for(){

      // }

      return E;
    }



    /**
     * TEST AREA END
     */



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