import type { RouterData, ListContext, Options, RouterResType } from "../types.js";
import { get } from "../utils/getData.js";

const typeMap: Record<string, string> = {
  realtime: "热搜",
  novel: "小说",
  movie: "电影",
  teleplay: "电视剧",
  car: "汽车",
  game: "游戏",
};

export const handleRoute = async (c: ListContext, noCache: boolean) => {
  const type = c.req.query("type") || "realtime";
  const listData = await getList({ type }, noCache);
  const routeData: RouterData = {
    name: "baidu",
    title: "百度",
    type: typeMap[type],
    params: {
      type: {
        name: "热搜类别",
        type: typeMap,
      },
    },
    link: "https://top.baidu.com/board",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface BaiduItem {
  index?: number;
  word?: string;
  title?: string;
  desc?: string;
  img?: string;
  imgInfo?: { src: string };
  show?: string;
  hotScore?: string;
  hotTag?: string;
  query?: string;
  rawUrl?: string;
  url?: string;
  content?: BaiduItem[];
}

// 递归查找“热榜条目数组”：不论 s-data 里嵌套多少层（data.cards / cards / content[0].content），
// 只要某个数组里的元素带有 word / hotScore 字段，就认定它是真正的榜单。
const pickHotList = (node: unknown): BaiduItem[] | null => {
  if (Array.isArray(node)) {
    const first = node[0];
    if (
      node.length > 0 &&
      first &&
      typeof first === "object" &&
      ("word" in (first as object) || "hotScore" in (first as object))
    ) {
      return node as BaiduItem[];
    }
    for (const child of node) {
      const found = pickHotList(child);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    for (const key of Object.keys(node as object)) {
      const found = pickHotList((node as Record<string, unknown>)[key]);
      if (found) return found;
    }
  }
  return null;
};

const getList = async (options: Options, noCache: boolean): Promise<RouterResType> => {
  const { type } = options;
  const url = `https://top.baidu.com/board?tab=${type}`;
  let result: any;
  try {
    result = await get<string>({
      url,
      noCache,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } catch {
    // 被目标站点 403 / 超时 / 网络失败时返回空列表，避免整个站点报错
    return { fromCache: false, updateTime: new Date().toISOString(), data: [] };
  }

  // 正则查找
  const pattern = /<!--s-data:(.*?)-->/s;
  const matchResult = result.data.match(pattern);
  if (!matchResult) {
    return { ...result, data: [] };
  }

  let jsonObject: BaiduItem[] = [];
  try {
    const sData = JSON.parse(matchResult[1]);
    jsonObject = pickHotList(sData) ?? [];
  } catch {
    jsonObject = [];
  }

  return {
    ...result,
    data: jsonObject
      .map((v, index: number) => {
        const title = v.word ?? v.title ?? "";
        return {
          id: v.index ?? index + 1,
          title,
          desc: v.desc ?? "",
          cover: v.img ?? v.imgInfo?.src ?? "",
          author: v.show?.length ? v.show : "",
          timestamp: 0,
          hot: parseInt((v.hotScore ?? v.hotTag ?? "0").toString(), 10) || 0,
          url: `https://www.baidu.com/s?wd=${encodeURIComponent(v.query ?? title)}`,
          mobileUrl: v.rawUrl ?? v.url ?? "",
        };
      })
      // 过滤掉没有标题的空壳对象（老结构遗留）
      .filter((v) => v.title),
  };
};
