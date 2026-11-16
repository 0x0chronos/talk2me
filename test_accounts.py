import http.cookiejar
import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
import server
import accounts

class AccountsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        server.DB_PATH=str(Path(cls.tmp.name)/'test.sqlite')
        accounts.DB=Path(server.DB_PATH)
        server.init_db();server.build_index();accounts.migrate()
        accounts.provision('admin@example.test','Admin-test-12345','Admin',True)
        cls.http=server.Server(('127.0.0.1',0),accounts.secure_handler(server.Handler))
        cls.url=f'http://127.0.0.1:{cls.http.server_port}'
        threading.Thread(target=cls.http.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown();cls.http.server_close();cls.tmp.cleanup()
    def client(self):return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(self,c,path,data=None,origin=None):
        headers={'Content-Type':'application/json'}
        if origin:headers['Origin']=origin
        req=urllib.request.Request(self.url+path,headers=headers,data=json.dumps(data).encode() if data is not None else None)
        try:r=c.open(req)
        except urllib.error.HTTPError as e:r=e
        with r:return r.status,json.load(r)
    def test_flow(self):
        admin=self.client();student=self.client();guest=self.client()
        self.assertEqual(self.request(guest,'/api/tree')[0],401)
        self.assertEqual(self.request(guest,'/api/auth/login',{'mode':'test_quick_switch'})[0],401)
        self.assertEqual(self.request(guest,'/api/auth/register',{'email':'x@y.test','password':'password123'})[0],401)
        self.assertEqual(self.request(admin,'/api/auth/login',{'email':'admin@example.test','password':'Admin-test-12345'})[0],200)
        self.assertEqual(self.request(admin,'/api/admin/users',{'email':'student@example.test','password':'Student-test-12345','full_name':'Aluno'})[0],201)
        self.assertEqual(self.request(student,'/api/auth/login',{'email':'student@example.test','password':'Student-test-12345'})[0],200)
        self.assertEqual(self.request(student,'/api/admin/users')[0],403)
        self.assertEqual(self.request(student,'/api/admin/users',{'email':'extra@example.test','password':'Student-test-12345'})[0],403)
        self.assertEqual(self.request(student,'/api/profile',{'role':'admin'},origin='https://evil.test')[0],403)
        tree=self.request(student,'/api/tree')[1]
        lessons=[i for l in tree['levels'] for m in l['modules'] for i in m['items']]
        self.assertTrue(all(i['stars']==0 for i in lessons))
        iid=lessons[0]['id']
        before=self.request(admin,'/api/profile')[1]['xp']
        data={'id':iid,'stars':3,'score':100,'xp':25,'event_id':'test-event'}
        self.assertEqual(self.request(student,'/api/finish',data)[0],200)
        self.assertTrue(self.request(student,'/api/finish',data)[1]['duplicate'])
        self.assertEqual(self.request(student,'/api/profile')[1]['xp'],25)
        self.assertEqual(self.request(admin,'/api/profile')[1]['xp'],before)
        self.assertEqual(self.request(student,'/api/auth/password',{'current_password':'wrong','new_password':'New-password-123'})[0],400)
        self.assertEqual(self.request(student,'/api/auth/password',{'current_password':'Student-test-12345','new_password':'New-password-123'})[0],200)
        self.assertEqual(self.request(guest,'/api/auth/login',{'email':'student@example.test','password':'Student-test-12345'})[0],401)
        self.assertEqual(self.request(guest,'/api/auth/login',{'email':'student@example.test','password':'New-password-123'})[0],200)
        users = self.request(admin,'/api/admin/users')[1]
        uid = next(u['id'] for u in users if u['email']=='student@example.test')
        change = {'user_id':uid,'new_password':'Admin-reset-12345'}
        endpoint = '/api/admin/student-password'
        self.assertEqual(self.request(student,endpoint,change)[0],403)
        self.assertEqual(self.request(admin,endpoint,{**change,'new_password':'curta'})[0],400)
        self.assertEqual(self.request(admin,endpoint,{**change,'user_id':next(u['id'] for u in users if u['role']=='admin')})[0],404)
        self.assertEqual(self.request(admin,endpoint,change)[0],200)
        self.assertEqual(self.request(student,'/api/profile')[0],401)
        self.assertEqual(self.request(guest,'/api/profile')[0],401)
        self.assertEqual(self.request(student,'/api/auth/login',{'email':'student@example.test','password':'New-password-123'})[0],401)
        self.assertEqual(self.request(student,'/api/auth/login',{'email':'student@example.test','password':change['new_password']})[0],200)
        self.assertEqual(self.request(student,'/api/profile')[1]['xp'],25)
        gz_req=urllib.request.Request(self.url+'/styles.css',headers={'Accept-Encoding':'gzip'})
        with student.open(gz_req) as r:
            self.assertEqual(r.headers.get('Content-Encoding'),'gzip')
            self.assertIn('max-age=3600',r.headers.get('Cache-Control',''))
            self.assertEqual(len(r.headers.get_all('Cache-Control')),1)
            etag=r.headers.get('ETag')
            self.assertTrue(etag)
        cond_req=urllib.request.Request(self.url+'/styles.css',headers={'If-None-Match':etag})
        try:
            student.open(cond_req)
            self.fail('Expected 304')
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code,304)
            e.close()
        tree_gz=urllib.request.Request(self.url+'/api/tree',headers={'Accept-Encoding':'gzip'})
        with student.open(tree_gz) as r:
            self.assertEqual(r.headers.get('Content-Encoding'),'gzip')
        self.assertEqual(self.request(student,'/api/auth/logout',{})[0],200)
        self.assertEqual(self.request(student,'/api/profile')[0],401)

if __name__=='__main__':unittest.main()
