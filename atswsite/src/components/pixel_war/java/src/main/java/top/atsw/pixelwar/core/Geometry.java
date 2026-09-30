package top.atsw.pixelwar.core;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 几何与空间索引工具。
 *
 * <p>对应前端 TS 版的 Point / CollisionBox / StaticEntitySpatialGrid。
 * 为贴近 TS 源码的书写习惯(频繁直接读写坐标),这里的向量与碰撞盒使用公有字段的可变对象,
 * 而不是不可变的 record。</p>
 */
public final class Geometry {

    private Geometry() {
    }

    /** 二维向量/点(世界坐标,单位 px) */
    public static final class Vec2 {
        public double x;
        public double y;

        public Vec2(double x, double y) {
            this.x = x;
            this.y = y;
        }

        public static Vec2 of(double x, double y) {
            return new Vec2(x, y);
        }

        public Vec2 copy() {
            return new Vec2(x, y);
        }

        public Vec2 set(double nx, double ny) {
            this.x = nx;
            this.y = ny;
            return this;
        }

        public Vec2 set(Vec2 other) {
            this.x = other.x;
            this.y = other.y;
            return this;
        }

        public double length() {
            return Math.hypot(x, y);
        }
    }

    /** 轴对齐碰撞盒 */
    public static final class Box {
        public double x;
        public double y;
        public double width;
        public double height;

        public Box(double x, double y, double width, double height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
        }

        public double maxX() {
            return x + width;
        }

        public double maxY() {
            return y + height;
        }

        /** 两盒重叠面积(0 表示不相交) */
        public double overlapArea(Box other) {
            double ox = Math.min(maxX(), other.maxX()) - Math.max(x, other.x);
            double oy = Math.min(maxY(), other.maxY()) - Math.max(y, other.y);
            if (ox <= 0 || oy <= 0) {
                return 0;
            }
            return ox * oy;
        }

        public boolean contains(double px, double py) {
            return px >= x && px <= maxX() && py >= y && py <= maxY();
        }
    }

    /** 两点距离 */
    public static double distance(double x1, double y1, double x2, double y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    }

    /** 把 v 限制在 [min, max] */
    public static double clamp(double v, double min, double max) {
        return v < min ? min : Math.min(v, max);
    }

    /** 线性插值 */
    public static double lerp(double a, double b, double t) {
        return a + (b - a) * t;
    }

    /** 角度转单位向量 */
    public static Vec2 fromAngle(double radians) {
        return new Vec2(Math.cos(radians), Math.sin(radians));
    }

    /**
     * 静态实体网格空间索引(对应 TS 版 StaticEntitySpatialGrid)。
     *
     * <p>用于快速判断点是否落在静态实体内部,以及取回矩形范围内的静态实体,
     * 避免每帧全量遍历静态实体列表。</p>
     */
    public static final class StaticGrid {
        private final double cellSize;
        private final Map<Long, List<Object>> grid = new HashMap<>();
        private final Map<Object, Box> boxOf = new HashMap<>();

        public StaticGrid(double cellSize) {
            this.cellSize = cellSize > 0 ? cellSize : 400;
        }

        /** 把一批"带碰撞盒的对象"放入索引 */
        public void index(Iterable<?> entities, java.util.function.Function<Object, Box> boxGetter) {
            grid.clear();
            boxOf.clear();
            for (Object entity : entities) {
                Box box = boxGetter.apply(entity);
                boxOf.put(entity, box);
                int minCellX = (int) Math.floor(box.x / cellSize);
                int maxCellX = (int) Math.floor(box.maxX() / cellSize);
                int minCellY = (int) Math.floor(box.y / cellSize);
                int maxCellY = (int) Math.floor(box.maxY() / cellSize);
                for (int cx = minCellX; cx <= maxCellX; cx++) {
                    for (int cy = minCellY; cy <= maxCellY; cy++) {
                        grid.computeIfAbsent(key(cx, cy), k -> new ArrayList<>()).add(entity);
                    }
                }
            }
        }

        private static long key(int cx, int cy) {
            return ((long) cx << 32) ^ (cy & 0xffffffffL);
        }

        /** 点是否与任一静态实体碰撞(检查自身与周围 8 个格子,避免边界遗漏) */
        public boolean isPointColliding(double x, double y) {
            int cellX = (int) Math.floor(x / cellSize);
            int cellY = (int) Math.floor(y / cellSize);
            for (int dx = -1; dx <= 1; dx++) {
                for (int dy = -1; dy <= 1; dy++) {
                    List<Object> list = grid.get(key(cellX + dx, cellY + dy));
                    if (list == null) {
                        continue;
                    }
                    for (Object entity : list) {
                        Box box = boxOf.get(entity);
                        if (box != null && box.contains(x, y)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        /** 取回与给定矩形相交的静态实体 */
        public List<Object> getEntitiesInRect(double x, double y, double width, double height) {
            int minCellX = (int) Math.floor(x / cellSize);
            int maxCellX = (int) Math.floor((x + width) / cellSize);
            int minCellY = (int) Math.floor(y / cellSize);
            int maxCellY = (int) Math.floor((y + height) / cellSize);
            List<Object> result = new ArrayList<>();
            Set<Object> added = new HashSet<>();
            for (int cx = minCellX; cx <= maxCellX; cx++) {
                for (int cy = minCellY; cy <= maxCellY; cy++) {
                    List<Object> list = grid.get(key(cx, cy));
                    if (list == null) {
                        continue;
                    }
                    for (Object entity : list) {
                        if (added.add(entity)) {
                            result.add(entity);
                        }
                    }
                }
            }
            return result;
        }

        /** 该对象登记的碰撞盒 */
        public Box boxOf(Object entity) {
            return boxOf.get(entity);
        }
    }
}
