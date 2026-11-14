from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'deploy'))
from export_mobile_progress import export


class ExportTest(unittest.TestCase):
    def test_export_is_read_only_and_accepted_by_the_phone(self):
        with tempfile.TemporaryDirectory(prefix='talk2me-export-test-') as directory:
            path=Path(directory)/'test.sqlite'
            with closing(sqlite3.connect(path)) as db:
                db.executescript('''
                CREATE TABLE users(id,email,full_name,xp,streak,longest_streak,last_activity_date,theme_pref,daily_goal_xp);
                INSERT INTO users VALUES ('alice','alice@example.test','Alice',25,1,1,'2026-11-14','dark',50);
                CREATE TABLE student_progress(user_id,lesson_id,stars,score,completed_at);
                INSERT INTO student_progress VALUES ('alice','lesson-1',3,100,'2026-11-14 15:00:00');
                CREATE TABLE user_resume(user_id,lang,lesson_id,step_index,level);
                CREATE TABLE activity_days(user_id,activity_date,xp_earned,lessons_completed);
                INSERT INTO activity_days VALUES ('alice','2026-11-14',25,1);
                CREATE TABLE finish_events(user_id,event_id);
                INSERT INTO finish_events VALUES ('alice','event-1');
                ''')
                db.commit()
            before=hashlib.sha256(path.read_bytes()).hexdigest()
            result=export(path,'alice')
            self.assertEqual(before,hashlib.sha256(path.read_bytes()).hexdigest())
            backup=Path(directory)/'backup.json'
            backup.write_text(json.dumps(result),encoding='utf8')
            script="const p=require('./mobile/progress.js');const fs=require('fs');const s=p.restore(fs.readFileSync(process.argv[1],'utf8'),{id:'alice'},new Set(['lesson-1']));if(p.profile(s).xp!==25)process.exit(1);"
            subprocess.run(['node','-e',script,str(backup)],cwd=ROOT,check=True,capture_output=True)


if __name__=='__main__':unittest.main()
