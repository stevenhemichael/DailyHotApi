import type { RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "weibo",
    title: "微博",
    type: "热搜榜",
    description: "实时热点，每分钟更新一次",
    link: "https://s.weibo.com/top/summary/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface WeiboItem {
  mid?: string;
  word?: string;
  word_scheme?: string;
  onboard_time?: number;
}

interface WeiboResponse {
  data?: {
    realtime: WeiboItem[];
  };
}

const getList = async (noCache: boolean) => {
  const url = "https://weibo.com/ajax/side/hotSearch";

  try {
    const result = await get<WeiboResponse>({
      url,
      noCache,
      ttl: 60,
      headers: {
        Referer: "https://weibo.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
    });

    const list = result.data?.data?.realtime;
    if (!Array.isArray(list) || !list.length) {
      return { ...result, data: [] as WeiboItem[] };
    }

    return {
      ...result,
      data: list.map((v, index: number) => {
        const title = v.word || v.word_scheme || `热搜${index + 1}`;
        return {
          id: v.mid || v.word_scheme || `weibo-${index}`,
          title: title,
          desc: v.word_scheme || `#${title}#`,
          timestamp: getTime(v.onboard_time || Date.now()),
          url: `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`,
          mobileUrl: `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`,
        };
      }),
    };
  } catch {
    // 被目标站点 403 / 超时 / 网络失败时返回空列表，避免整个站点报错
    return {
      fromCache: false,
      updateTime: new Date().toISOString(),
      data: [] as WeiboItem[],
    };
  }
};
