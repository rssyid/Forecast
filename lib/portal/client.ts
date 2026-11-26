import type { PortalCoverageDataset } from '../types';
import {
  parsePortalCoveragesPayload,
  parsePortalDatasetPayload,
} from './schemas';

const BASE_URL = 'https://app.gis-div.com/iot/';
const LOGIN_URL = `${BASE_URL}Default.aspx`;
const SERVICE_URL = `${BASE_URL}Service/webservice.asmx`;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface PortalClientOptions {
  username: string;
  password: string;
  maxRetries?: number;
  baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractHiddenField(name: string, html: string): string {
  const esc = escapeRegExp(name);
  const pattern1 = new RegExp(
    `name=["']${esc}["'][^>]*value=["']([^"']*)["']`,
    'i'
  );
  const pattern2 = new RegExp(
    `value=["']([^"']*)["'][^>]*name=["']${esc}["']`,
    'i'
  );
  const match = html.match(pattern1) ?? html.match(pattern2);
  return match ? match[1] : '';
}

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = `${err.name} ${err.message}`.toLowerCase();
  return (
    msg.includes('abort') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket') ||
    msg.includes('fetch failed') ||
    msg.includes('http 5')
  );
}

export class PortalClient {
  private readonly username: string;
  private readonly password: string;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly cookies = new Map<string, string>();
  private loggedIn = false;

  constructor(options: PortalClientOptions) {
    if (!options.username || !options.password) {
      throw new Error('PORTAL_USERNAME dan PORTAL_PASSWORD wajib diisi.');
    }
    this.username = options.username;
    this.password = options.password;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 2000;
  }

  private captureCookies(headers: Headers): void {
    const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
      .getSetCookie;
    const rawCookies =
      typeof getSetCookie === 'function'
        ? getSetCookie.call(headers)
        : headers.get('set-cookie')
          ? [headers.get('set-cookie') as string]
          : [];

    for (const raw of rawCookies) {
      const pair = raw.split(';')[0]?.trim();
      if (!pair) continue;
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        this.cookies.set(pair.slice(0, eqIdx).trim(), pair.slice(eqIdx + 1).trim());
      }
    }
  }

  private buildCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const cookieHeader = this.buildCookieHeader();
    const headers = new Headers(init.headers);
    headers.set('User-Agent', USER_AGENT);
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader);
    }

    try {
      const res = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });
      this.captureCookies(res.headers);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  private async withRetry<T>(
    label: string,
    fn: () => Promise<T>
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt === this.maxRetries || !isTransientNetworkError(err)) {
          throw err;
        }
        const delayMs = this.baseDelayMs * attempt;
        console.warn(
          `[PortalClient] ${label} gagal (percobaan ${attempt}/${this.maxRetries}): ${err instanceof Error ? err.message : String(err)}. Mengulang dalam ${delayMs} ms...`
        );
        await sleep(delayMs);
      }
    }
    throw lastError;
  }

  async login(): Promise<void> {
    await this.withRetry('login', async () => {
      const getRes = await this.fetchWithTimeout(
        LOGIN_URL,
        { method: 'GET', redirect: 'manual' },
        30000
      );
      if (!getRes.ok && (getRes.status < 300 || getRes.status >= 400)) {
        throw new Error(`HTTP ${getRes.status} saat membuka halaman login`);
      }

      const html = await getRes.text();
      const viewState = extractHiddenField('__VIEWSTATE', html);
      const viewStateGen = extractHiddenField('__VIEWSTATEGENERATOR', html);
      const eventVal = extractHiddenField('__EVENTVALIDATION', html);

      if (!viewState) {
        throw new Error('Gagal mengekstrak __VIEWSTATE dari halaman login portal.');
      }

      const body = new URLSearchParams({
        __VIEWSTATE: viewState,
        __VIEWSTATEGENERATOR: viewStateGen,
        __EVENTVALIDATION: eventVal,
        username: this.username,
        password: this.password,
        btnLogin: 'Sign In',
      });

      const postRes = await this.fetchWithTimeout(
        LOGIN_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: 'https://app.gis-div.com',
            Referer: LOGIN_URL,
          },
          body: body.toString(),
          redirect: 'manual',
        },
        45000
      );

      if (postRes.status >= 500) {
        throw new Error(`HTTP ${postRes.status} saat autentikasi portal`);
      }

      const location = postRes.headers.get('location') ?? '';
      if (
        postRes.status >= 300 &&
        postRes.status < 400 &&
        location.toLowerCase().includes('mainmenu.aspx')
      ) {
        this.loggedIn = true;
        return;
      }

      const postText = await postRes.text();
      const redirectedUrl = postRes.url || '';
      if (
        redirectedUrl.toLowerCase().includes('mainmenu.aspx') ||
        (!postText.includes('btnLogin') && this.cookies.has('ASP.NET_SessionId'))
      ) {
        this.loggedIn = true;
        return;
      }

      throw new Error(
        'Login portal ditolak atau gagal mengalihkan ke MainMenu.aspx (periksa username/password).'
      );
    });
  }

  async ensureLoggedIn(): Promise<void> {
    if (!this.loggedIn) {
      await this.login();
    }
  }

  async getCoverages(): Promise<string[]> {
    await this.ensureLoggedIn();
    return this.withRetry('GetListAWLKLHK', async () => {
      const res = await this.fetchWithTimeout(
        `${SERVICE_URL}/GetListAWLKLHK`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({}),
        },
        45000
      );

      if (res.status >= 500) {
        throw new Error(`HTTP ${res.status} dari GetListAWLKLHK`);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} saat mengambil daftar coverage`);
      }

      const json = (await res.json()) as { d?: string };
      const rawList = JSON.parse(json.d || '[]');
      return parsePortalCoveragesPayload(rawList);
    });
  }

  async getCoverageData(
    region: string,
    dateFrom: string,
    dateTo: string
  ): Promise<PortalCoverageDataset> {
    await this.ensureLoggedIn();
    return this.withRetry(`getAllIotTMATByRegionAllData(${region})`, async () => {
      const res = await this.fetchWithTimeout(
        `${SERVICE_URL}/getAllIotTMATByRegionAllData`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({ region, dateFrom, dateTo }),
        },
        75000
      );

      if (res.status >= 500) {
        throw new Error(`HTTP ${res.status} untuk coverage "${region}"`);
      }
      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status} saat mengambil data coverage "${region}"`
        );
      }

      const json = (await res.json()) as { d?: string };
      const rawStr = json.d;
      if (!rawStr) {
        return { Table: [], Table1: [], Table2: [], Table3: [], Table4: [] };
      }

      let decoded: unknown;
      try {
        decoded = JSON.parse(rawStr);
      } catch (err) {
        throw new Error(
          `Respons JSON tidak valid pada field "d" untuk "${region}": ${err instanceof Error ? err.message : String(err)}`
        );
      }

      return parsePortalDatasetPayload(decoded);
    });
  }
}
