"""Export local progress as a phone-readable backup, opening SQLite read-only."""
import argparse
from contextlib import closing
from datetime import date, datetime, timezone
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]


def export(db_path, user_id):
    uri = Path(db_path).resolve().as_uri() + '?mode=ro'
    with closing(sqlite3.connect(uri,uri=True)) as db:
        db.row_factory = sqlite3.Row
        row = db.execute('SELECT id,email,full_name,xp,streak,longest_streak,last_activity_date,theme_pref,daily_goal_xp FROM users WHERE id=?',(user_id,)).fetchone()
        if not row:
            raise ValueError('Conta não encontrada. Use --list para consultar os identificadores.')
        user = dict(row)
        activity_date = user['last_activity_date']
        if activity_date:
            activity_date = date.fromisoformat(activity_date[:10]).isoformat()
        state = {
            'user':{key:user[key] or ('Estudante' if key == 'full_name' else '') for key in ('id','email','full_name')},
            'xp':user['xp'] or 0, 'streak':user['streak'] or 0,
            'longest_streak':max(user['longest_streak'] or 0,user['streak'] or 0),
            'last_activity_date':activity_date,
            'theme_pref':user['theme_pref'] if user['theme_pref'] in ('light','dark','system') else 'light',
            'daily_goal_xp':max(10,min(1000,user['daily_goal_xp'] or 50)),
            'progress':{},'resume':{},'activity':{},'events':[]
        }
        for entry in db.execute('SELECT lesson_id,stars,score,completed_at FROM student_progress WHERE user_id=?',(user_id,)):
            if entry['stars']:
                state['progress'][entry['lesson_id']] = {
                    'stars':entry['stars'],'score':entry['score'] or 0,
                    'completed_at':(entry['completed_at'] or activity_date or date.today().isoformat())[:10]
                }
        for entry in db.execute('SELECT lang,lesson_id,step_index,level FROM user_resume WHERE user_id=?',(user_id,)):
            if entry['lang'] == 'es':
                state['resume']['es'] = {'lessonId':entry['lesson_id'],'stepIndex':entry['step_index'] or 0,'level':entry['level'] or 'A1'}
        for entry in db.execute('SELECT activity_date,xp_earned,lessons_completed FROM activity_days WHERE user_id=?',(user_id,)):
            state['activity'][entry['activity_date']] = {'xp':entry['xp_earned'] or 0,'lessons':entry['lessons_completed'] or 0}
        state['events'] = [entry[0] for entry in db.execute('SELECT event_id FROM finish_events WHERE user_id=?',(user_id,))]
        return {'format':'talk2me-mobile-progress','version':1,'exportedAt':datetime.now(timezone.utc).isoformat(),'state':state}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--user-id',help='ID of the account whose progress should be exported.')
    parser.add_argument('--list',action='store_true',help='Show account identifiers; no password material is printed.')
    parser.add_argument('--database',type=Path,default=ROOT/'database.sqlite')
    parser.add_argument('--out',type=Path,default=ROOT/'backups'/('mobile-progresso-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'.json'))
    args=parser.parse_args()
    if args.list:
        with closing(sqlite3.connect(args.database.resolve().as_uri()+'?mode=ro',uri=True)) as db:
            print(json.dumps([{'id':row[0],'email':row[1],'name':row[2]} for row in db.execute('SELECT id,email,full_name FROM users WHERE email IS NOT NULL')],ensure_ascii=False))
        return
    if not args.user_id:
        parser.error('Informe --user-id ou use --list.')
    data=export(args.database,args.user_id)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    with args.out.open('x',encoding='utf8') as file:
        json.dump(data,file,ensure_ascii=False,indent=2)
    args.out.chmod(0o600)
    print('Backup privado criado em '+str(args.out.resolve()))


if __name__=='__main__':main()
