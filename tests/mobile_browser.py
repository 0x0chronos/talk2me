"""Run real browser checks against disposable PHP accounts and small media fixtures."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from playwright.sync_api import sync_playwright, expect
from mobile_fixture import Host, ROOT


class MobileBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix='talk2me-browser-test-')
        cls.host=Host(cls.temp.name,actual_media=True)
        cls.playwright=sync_playwright().start()
        cls.engine=os.environ.get('BROWSER_ENGINE','chromium')
        cls.browser=getattr(cls.playwright,cls.engine).launch()
        cls.output=ROOT/'test-results';cls.output.mkdir(exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.host.close();cls.temp.cleanup()

    def context(self):
        return self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)

    def login(self,context,email='alice@example.test',password='Alice-test-12345'):
        page=context.new_page()
        page.goto(self.host.url)
        page.locator('#login-form input[name=email]').fill(email)
        page.locator('#login-form input[name=password]').fill(password)
        page.locator('#login-form button').click()
        expect(page.locator('body')).not_to_have_class('locked')
        page.wait_for_function('() => !!navigator.serviceWorker.controller')
        return page

    def open_first(self,page):
        page.locator('#mods .cell').first.click()
        expect(page.locator('#lesson-preview')).to_be_visible()

    def complete(self,page):
        page.locator('#lesson-preview .btn').click()
        if self.engine == 'chromium':
            page.wait_for_function('() => document.querySelector("#player video")?.readyState >= 1')
        else:
            # Windows WebKit's media backend differs from Safari's. Verify delivery
            # here; native MP4 decoding must still be checked on the real iPhone.
            expect(page.locator('#player video')).to_be_visible()
            self.assertEqual(page.evaluate("async()=> (await fetch('/m/video.mp4',{headers:{Range:'bytes=0-9'}})).status"),206)
        page.locator('#pbtn').click()
        page.locator('#pbody .opt').filter(has_text='Hola').click()
        page.locator('#pbtn').click()
        page.locator('#pbtn').click()
        expect(page.locator('#pfb')).to_contain_text('Progresso salvo neste celular')
        page.locator('#pbtn').click()
        expect(page.locator('#player')).to_be_hidden()

    def account(self,page):
        page.locator('.mobile-nav [data-nav=account]').click()
        expect(page.locator('#backup-export')).to_be_visible()

    def test_online_optional_download_offline_reopen_and_backup(self):
        alice,bob=self.context(),self.context()
        try:
            page=self.login(alice)
            errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
            self.open_first(page)
            expect(page.locator('#lesson-preview')).to_contain_text('Baixar é opcional')
            self.complete(page)
            self.assertEqual(page.evaluate('S.profile.xp'),25)
            self.assertEqual(page.evaluate('MobileApp.downloads.list(MobileApp.user.id).then(v=>v.length)'),0)
            other=self.login(bob,'bob@example.test','Bob-test-12345')
            self.assertEqual(other.evaluate('S.profile.xp'),0)
            page.reload()
            expect(page.locator('body')).not_to_have_class('locked')
            self.assertEqual(page.evaluate('S.profile.xp'),25)
            self.account(page)
            with page.expect_download() as download:
                page.locator('#backup-export').click()
            backup=self.output/('mobile-progress-test-'+self.engine+'.json')
            download.value.save_as(backup)
            data=json.loads(backup.read_text())
            self.assertEqual(data['state']['xp'],25)
            self.assertNotIn('hash',data['state']['user'])
            page.locator('#drawer-close').click()
            self.open_first(page)
            page.locator('#lesson-download').click()
            expect(page.locator('#lesson-download')).to_have_text('Remover download desta aula',timeout=30000)
            page.locator('#lesson-preview').get_by_role('button',name='Voltar',exact=True).click()
            expect(page.locator('.downloaded-label')).to_have_count(1)
            page.evaluate('() => window.scrollTo(0,0)')
            page.screenshot(path=str(self.output/('mobile-online-'+self.engine+'.png')),full_page=True,animations='disabled')
            self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'),390)
            # Close the window, then reopen the installed shell with no network.
            self.host.stop()
            alice.set_offline(True);page.close();page=alice.new_page()
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(self.host.url)
            expect(page.locator('body')).not_to_have_class('locked',timeout=15000)
            self.assertEqual(page.evaluate('S.profile.xp'),25)
            self.open_first(page)
            self.complete(page)
            expect(page.locator('#xp')).to_contain_text('31 XP')
            result=page.evaluate('''async()=>{
                const response=await fetch('/m/video.mp4',{headers:{Range:'bytes=-10'}});
                return {status:response.status,length:(await response.arrayBuffer()).byteLength,range:response.headers.get('Content-Range')};
            }''')
            self.assertEqual(result['status'],206);self.assertEqual(result['length'],10)
            self.account(page)
            page.screenshot(path=str(self.output/('mobile-offline-account-'+self.engine+'.png')),animations='disabled')
            page.locator('#backup-file').set_input_files(backup)
            expect(page.locator('#restore-confirm')).to_contain_text('25 XP')
            page.locator('#restore-confirm-button').click()
            expect(page.locator('#mobile-status')).to_have_text('Progresso restaurado neste celular.')
            self.assertEqual(page.evaluate('S.profile.xp'),25)
            foreign=json.loads(backup.read_text());foreign['state']['user']['id']='bob'
            page.locator('#backup-file').set_input_files({'name':'other.json','mimeType':'application/json','buffer':json.dumps(foreign).encode()})
            expect(page.locator('#mobile-status')).to_contain_text('outra conta')
            self.assertEqual(page.evaluate('S.profile.xp'),25)
            page.locator('#manage-downloads').click()
            page.locator('#downloads-dialog').get_by_role('button',name='Remover download',exact=True).click()
            expect(page.locator('#downloads-dialog article')).to_have_count(0)
            self.assertEqual(page.evaluate('MobileApp.downloads.list(MobileApp.user.id).then(v=>v.length)'),0)
            self.assertEqual(page.evaluate('S.profile.xp'),25)
            self.assertEqual(other.evaluate('S.profile.xp'),0)
            self.assertEqual(errors,[])
        finally:
            alice.close();bob.close()
            if self.host.process.poll() is not None:self.host.start()

    def test_failed_download_is_never_marked_complete(self):
        context=self.context()
        audio=self.host.out/'private/media/audio.mp3'
        original=audio.read_bytes()
        try:
            page=self.login(context)
            # A genuinely incomplete file on the disposable server, so both
            # engines exercise the real worker/network path without route mocks.
            audio.write_bytes(b'')
            self.open_first(page)
            page.locator('#lesson-download').click()
            expect(page.locator('#lesson-download')).to_have_text('Tentar baixar novamente',timeout=30000)
            self.assertEqual(page.evaluate('MobileApp.downloads.list(MobileApp.user.id).then(v=>v.length)'),0)
            self.assertEqual(page.evaluate('caches.keys().then(v=>v.filter(k=>k.startsWith(MobileDownloads.prefix)).length)'),0)
            self.assertEqual(page.evaluate('S.profile.xp'),0)
        finally:audio.write_bytes(original);context.close()

    def test_account_ids_with_common_prefix_do_not_share_downloads(self):
        context=self.context()
        try:
            page=self.login(context)
            counts=page.evaluate('''async()=>{
                const cache=await caches.open(MobileApp.downloads.name('alice-other','lesson-x'));
                await cache.put('/m/test.mp4',new Response('test'));
                await cache.put(MobileDownloads.marker,new Response(JSON.stringify({id:'lesson-x',paths:['/m/test.mp4']})));
                return [ (await MobileApp.downloads.list('alice')).length,
                         (await MobileApp.downloads.list('alice-other')).length ];
            }''')
            self.assertEqual(counts,[0,1])
        finally:context.close()

    def test_indexeddb_commits_concurrent_events_once_and_keeps_accounts_separate(self):
        context=self.context()
        try:
            page=self.login(context)
            result=page.evaluate('''async()=>{
                const ids=[...MobileApp.items.keys()];
                const event={id:ids[0],stars:3,score:100,xp:25,event_id:'concurrent-event-1'};
                const results=await Promise.all([
                    ...Array.from({length:5},()=>StudyAPI.request('/api/finish',event)),
                    StudyAPI.request('/api/finish',{...event,id:ids[1],event_id:'concurrent-event-2'})
                ]);
                const profile=await StudyAPI.request('/api/profile');
                const other=await MobileApp.store.change({id:'another-account'},state=>Talk2MeProgress.profile(state));
                return {xp:profile.xp,done:profile.stats.es,gained:results.reduce((sum,r)=>sum+r.gained,0),otherXp:other.xp};
            }''')
            self.assertEqual(result,{'xp':50,'done':2,'gained':50,'otherXp':0})
        finally:context.close()


if __name__=='__main__':unittest.main()
