import http.cookiejar
import json
import tempfile
import unittest
import urllib.error
import urllib.request
from mobile_fixture import Host


class MobileHostTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix='talk2me-host-test-')
        cls.host=Host(cls.temp.name)

    @classmethod
    def tearDownClass(cls):
        cls.host.close();cls.temp.cleanup()

    def client(self):
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(self, client, path, data=None, headers=None):
        request=urllib.request.Request(self.host.url+path,headers={'Content-Type':'application/json',**(headers or {})},
            data=json.dumps(data).encode() if data is not None else None)
        try:response=client.open(request)
        except urllib.error.HTTPError as error:response=error
        with response:return response.status,response.headers,response.read()

    def login(self,client):
        self.assertEqual(self.request(client,'/api/auth/login',{'email':'alice@example.test','password':'Alice-test-12345'})[0],200)

    def test_content_is_private_and_range_supports_video_seeking(self):
        guest=self.client()
        for path in ['/api/course','/api/lesson/'+self.host.ids[0],'/m/video.mp4','/private/accounts.json']:
            self.assertEqual(self.request(guest,path)[0],401)
        self.assertEqual(self.request(guest,'/api/auth/login',{'email':'alice@example.test','password':'wrong-password'})[0],401)
        self.login(guest)
        status,headers,body=self.request(guest,'/api/course')
        self.assertEqual(status,200);self.assertIn('levels',json.loads(body))
        for path in ['/private/accounts.json','/../private/accounts.json','/m/../accounts.json','/api/lesson/../accounts']:
            self.assertEqual(self.request(guest,path)[0],404)
        status,headers,body=self.request(guest,'/m/video.mp4',headers={'Range':'bytes=10-29'})
        self.assertEqual(status,206);self.assertEqual(len(body),20);self.assertEqual(headers['Content-Range'],'bytes 10-29/2048')
        self.assertEqual(body,(bytes(range(256))*8)[10:30])
        self.assertEqual(self.request(guest,'/m/video.mp4',headers={'Range':'bytes=-10'})[2],(bytes(range(256))*8)[-10:])
        self.assertEqual(self.request(guest,'/m/video.mp4',headers={'Range':'bytes=3000-'})[0],416)
        self.assertEqual(self.request(guest,'/api/auth/logout',{})[0],200)
        self.assertEqual(self.request(guest,'/m/video.mp4')[0],401)

    def test_origin_and_password_change_revoke_other_online_sessions(self):
        a,b=self.client(),self.client()
        self.login(a);self.login(b)
        data={'current_password':'Alice-test-12345','new_password':'Alice-new-12345'}
        self.assertEqual(self.request(a,'/api/auth/password',data,{'Origin':'https://evil.example'})[0],403)
        self.assertEqual(self.request(a,'/api/auth/password',data)[0],200)
        self.assertEqual(self.request(b,'/api/course')[0],401)
        self.assertEqual(self.request(a,'/api/course')[0],200)
        # Restore the fixture's original password so test ordering is immaterial.
        self.assertEqual(self.request(a,'/api/auth/password',{'current_password':'Alice-new-12345','new_password':'Alice-test-12345'})[0],200)


if __name__=='__main__':unittest.main()
