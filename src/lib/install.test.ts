import { describe, expect, it } from 'vitest'
import {
  INSTALL_PROMPT_KEY,
  detectPlatform,
  isAppInstalled,
  manualInstallHint,
  readInstallPromptOutcome,
  saveInstallPromptOutcome,
  shouldInviteInstall,
  type BrowserFacts,
  type StorageLike,
} from './install'

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  ipadSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
}

function facts(overrides: Partial<BrowserFacts> = {}): BrowserFacts {
  return {
    userAgent: UA.androidChrome,
    maxTouchPoints: 5,
    standaloneDisplay: false,
    iosStandalone: false,
    androidApp: false,
    ...overrides,
  }
}

class MemStorage implements StorageLike {
  private data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

describe('sistema por trás do navegador', () => {
  it('reconhece o iPhone em qualquer navegador', () => {
    expect(detectPlatform(facts({ userAgent: UA.iphoneSafari }))).toBe('ios')
    expect(detectPlatform(facts({ userAgent: UA.iphoneChrome }))).toBe('ios')
  })

  it('reconhece o iPad, que se anuncia como Mac, pelo toque na tela', () => {
    expect(detectPlatform(facts({ userAgent: UA.ipadSafari, maxTouchPoints: 5 }))).toBe('ios')
  })

  it('não confunde o Mac de verdade com um iPad', () => {
    expect(detectPlatform(facts({ userAgent: UA.macSafari, maxTouchPoints: 0 }))).toBe('desktop')
  })

  it('reconhece o Android e o computador', () => {
    expect(detectPlatform(facts({ userAgent: UA.androidChrome }))).toBe('android')
    expect(detectPlatform(facts({ userAgent: UA.androidFirefox }))).toBe('android')
    expect(detectPlatform(facts({ userAgent: UA.windowsChrome, maxTouchPoints: 0 }))).toBe('desktop')
  })
})

describe('app já instalado', () => {
  it('vê o app aberto fora da aba do navegador', () => {
    expect(isAppInstalled(facts({ standaloneDisplay: true }))).toBe(true)
    expect(isAppInstalled(facts({ iosStandalone: true }))).toBe(true)
    expect(isAppInstalled(facts({ androidApp: true }))).toBe(true)
  })

  it('na aba comum, não está instalado', () => {
    expect(isAppInstalled(facts())).toBe(false)
  })
})

describe('caminho manual de instalação', () => {
  it('manda o iPhone e o iPad pela folha de compartilhamento, seja qual for o navegador', () => {
    for (const userAgent of [UA.iphoneSafari, UA.iphoneChrome, UA.ipadSafari]) {
      expect(manualInstallHint(facts({ userAgent }))).toContain('Compartilhar')
    }
  })

  it('manda o Android pelo menu do navegador', () => {
    expect(manualInstallHint(facts({ userAgent: UA.androidChrome }))).toContain('tela inicial')
    expect(manualInstallHint(facts({ userAgent: UA.androidFirefox }))).toContain('menu')
  })

  it('no Mac aponta o Dock, e no Chrome a barra de endereço', () => {
    expect(manualInstallHint(facts({ userAgent: UA.macSafari, maxTouchPoints: 0 }))).toContain(
      'Dock',
    )
    expect(manualInstallHint(facts({ userAgent: UA.windowsChrome, maxTouchPoints: 0 }))).toContain(
      'barra de endereço',
    )
  })

  it('no Firefox do computador, que não instala, indica outro navegador', () => {
    expect(manualInstallHint(facts({ userAgent: UA.windowsFirefox, maxTouchPoints: 0 }))).toContain(
      'Chrome',
    )
  })

  it('sempre tem algo a dizer', () => {
    for (const userAgent of Object.values(UA)) {
      expect(manualInstallHint(facts({ userAgent })).length).toBeGreaterThan(0)
    }
  })
})

describe('memória do convite', () => {
  it('convida na primeira abertura e cala depois', () => {
    const storage = new MemStorage()
    expect(shouldInviteInstall(facts(), storage)).toBe(true)

    saveInstallPromptOutcome(storage, 'visto')
    expect(storage.getItem(INSTALL_PROMPT_KEY)).toBe('visto')
    expect(shouldInviteInstall(facts(), storage)).toBe(false)
  })

  it('não convida quem já instalou, mesmo sem memória', () => {
    expect(shouldInviteInstall(facts({ standaloneDisplay: true }), new MemStorage())).toBe(false)
  })

  it('ignora valor estranho guardado', () => {
    const storage = new MemStorage()
    storage.setItem(INSTALL_PROMPT_KEY, 'sei-la')
    expect(readInstallPromptOutcome(storage)).toBeNull()
  })

  it('sem armazenamento, o convite acontece assim mesmo', () => {
    expect(readInstallPromptOutcome(null)).toBeNull()
    expect(() => saveInstallPromptOutcome(null, 'visto')).not.toThrow()
    expect(shouldInviteInstall(facts(), null)).toBe(true)
  })

  it('não quebra quando o armazenamento recusa escrever', () => {
    const bloqueado: StorageLike = {
      getItem() {
        throw new Error('acesso negado')
      },
      setItem() {
        throw new Error('acesso negado')
      },
    }
    expect(readInstallPromptOutcome(bloqueado)).toBeNull()
    expect(() => saveInstallPromptOutcome(bloqueado, 'dispensado')).not.toThrow()
  })
})
