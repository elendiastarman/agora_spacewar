from django.shortcuts import render, redirect
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.core.urlresolvers import reverse
from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned

from django.template import Context, RequestContext
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
from django.views.decorators.csrf import csrf_exempt

from agora_spacewar.models import *

import os
import sys
import json
import html
import urllib
import psycopg2
import traceback
import subprocess

# Create your views here.
def main_view(request, *args, **kwargs):

    context = RequestContext(request)

    if sys.platform == 'win32':
        path = os.path.join(os.getcwd(),"agora_spacewar","static","agora_spacewar")
    elif sys.platform == 'linux':
        path = os.path.join("/home","elendia","webapps","agora","codetest","agora_spacewar","static","agora_spacewar","")

    paths = [(path,""), (os.path.join(path,"bots"),"bots/")]

    scripts = []
    for path, plus in paths:
        for filename in os.listdir(path):
            if filename.endswith('.js'): scripts.append('agora_spacewar/'+plus+filename)
    context['scripts'] = scripts
    
    context['sql'] = """SELECT R.id, "frameStart", "frameEnd", p1win, p2win, tie, p1missiles, p2missiles,
       P1.username as "Red name", P2.username as "Blue name"

FROM "agora_spacewar_round" R,
     (SELECT id FROM "agora_spacewar_game" ORDER BY id DESC LIMIT 1) as X,
     "agora_spacewar_player" P1,
     "agora_spacewar_player" P2

WHERE R.game_id = X.id
  AND R.player1_id = P1.id
  AND R.player2_id = P2.id

ORDER BY R.id;"""

    return render(request, 'agora_spacewar/main.html', context=context)

@csrf_exempt
def api_data_view(request, *args, **kwargs):
    context = RequestContext(request)
    
    events = json.loads(request.POST['events'])
    meta = json.loads(request.POST['meta'])
    stats = json.loads(request.POST['stats'])
    
    # print("len(events):",len(events))
    # print("meta:",meta)
    print("stats['game']:",stats["game"])
    
    try:
        player1 = Player.objects.get(username=meta["red"])
    except ObjectDoesNotExist:
        player1 = Player(username=meta["red"], email=meta["red"]+"@example.com")
        player1.save()
    
    try:
        player2 = Player.objects.get(username=meta["blue"])
    except ObjectDoesNotExist:
        player2 = Player(username=meta["blue"], email=meta["blue"]+"@example.com")
        player2.save()
    
    numRounds=len(stats["rounds"])
    
    game = Game(player1=player1, player2=player2, frameEnd=meta["gameEnd"], numRounds=numRounds,
                p1score=stats["game"]["p1score"], p2score=stats["game"]["p2score"],
                p1missiles=stats["game"]["p1missiles"], p2missiles=stats["game"]["p2missiles"],
                p1wins=stats["game"]["p1wins"], p2wins=stats["game"]["p2wins"], ties=stats["game"]["ties"])
    game.save()
    
    player1.numGames += 1
    player1.numWins += game.p1wins > game.p2wins
    player1.numLosses += game.p1wins < game.p2wins
    player1.numTies += game.p1wins == game.p2wins
    player1.numMissiles += game.p1missiles
    player1.save()
    
    player2.numGames += 1
    player2.numWins += game.p1wins > game.p2wins
    player2.numLosses += game.p1wins < game.p2wins
    player2.numTies += game.p1wins == game.p2wins
    player2.numMissiles += game.p2missiles
    player2.save()
    
    rounds = []
    
    for round in stats["rounds"]:
        r = Round(player1=player1, player2=player2, game=game,
                  frameStart=round["frameStart"], frameEnd=round["frameEnd"],
                  p1missiles=round["p1missiles"], p2missiles=round["p2missiles"],
                  p1win=round["p1win"], p2win=round["p2win"], tie=round["tie"])
        r.save()
        rounds.append(r)
    
    idx = 0
    events_to_create = []
    for event in events:
        if idx >= len(rounds): idx = len(rounds)-1
        if event["frame"] > rounds[idx].frameEnd:
            idx += 1
        if idx >= len(rounds): idx = len(rounds)-1
        
        e = Event(round=rounds[idx], type=event["type"], frame=event["frame"])
        
        if "team" in event:
            if event["team"] == "red":
                e.player = player1
            elif event["team"] == "blue":
                e.player = player2
        
        for name in ["status", "score", "way", "shape", "mid", "why"]:
            if name in event: e.__setattr__(name, event[name])
        
        if "mteam" in event:
            if event["mteam"] == "red":
                e.mteam = player1
            elif event["mteam"] == "blue":
                e.mteam = player2
        
        if event["type"] == "achievement":
            try:
                at = AchievementTemplate.objects.get(name=event["name"])
            except ObjectDoesNotExist:
                at = AchievementTemplate(name=event["name"], description="<need description>")
                at.save()
            
            a = Achievement(template=at, game=game, round=rounds[idx], frame=event["frame"])
            if event["team"] == "red":
                a.player = player1
            elif event["team"] == "blue":
                a.player = player2
            a.save()
        
        events_to_create.append(e)
    
    Event.objects.bulk_create(events_to_create)
    
    return HttpResponse("success", content_type="text/html")

# def api_read_view(request, *args, **kwargs):
    # context = RequestContext(request)
    
    # data = json.loads(request.POST['data'])
    # models = [["player", Player], ["game", Game], 
    
    # for name,model in models:
        # if name+"-rows" in data:
            # pass
    
    # return HttpResponse(json.dumps(data), content_type="text/json")

@csrf_exempt
def api_query_view(request, **kwargs):
    context = RequestContext(request)

    # filename = ''.join(random.choice(string.ascii_letters) for _ in range(10))
    # pathpref = "/home/elendia/webapps/ppcg/PPCG/" if sys.platform == 'linux' else ""
    # filepath = os.path.join(pathpref+"transcriptAnalyzer","queries",filename)

    # f = open(filepath + "In.txt", 'w', encoding='utf-8')
    querystring = 'SET statement_timeout TO 10000;\n' + request.POST['query']
    # f.write(querystring)
    # f.close()

    # f = open(filepath + "JS.txt", 'w', encoding='utf-8')
    # f.write(request.POST['javascript'])
    # f.close()

    data = {}
    # data['filename'] = filename
    data['error'] = ""
    data['results_html'] = ""
    data['results_json'] = ""

    con = psycopg2.connect(database="agora_codetest",
                           user="aganon",
                           password="foobar",
                           host="127.0.0.1",
                           port="5432" if sys.platform == "win32" else "20526")
    cur = con.cursor()
    error = ""

    try:
        cur.execute(querystring)
    except (psycopg2.ProgrammingError, psycopg2.extensions.QueryCanceledError, psycopg2.DataError) as e:
        con.rollback()
        error = str(e)

    if error:
        data["error"] = error
    else:
        results = cur.fetchall()
        headers = [column.name for column in cur.description]
        htmlstr = "<table border='1' class='sortable' id='query-table'><tr>%s</tr>" % ''.join('<th>%s</th>' % header for header in headers)
        jsonlist = []

        for row in results:
            htmlstr += "<tr>"

            for i,val in enumerate(row):
                # thingy = ""
                # if headers[i] == "mid":
                    # midurl = "http://chat.stackexchange.com/transcript/message/%s#%s" % (val, val)
                    # htmlstr += "<td><a href=\"%s\">%s</a></td>" % (midurl, val)
                # elif headers[i] == "uid":
                    # uidurl = "http://chat.stackexchange.com/users/%s" % val
                    # htmlstr += "<td><a href=\"%s\">%s</a></td>" % (uidurl, val)
                # elif headers[i] == "content_rendered":
                    # htmlstr += "<td>%s</td>" % val
                # else:
                    # htmlstr += "<td>%s</td>" % html.escape(str(val))
                htmlstr += "<td>%s</td>" % html.escape(str(val))

            htmlstr += "</tr>"
            
            jsonlist.append({key:str(val) for key,val in zip(headers, row)})

        htmlstr += "</table>"

        data["results_html"] = htmlstr
        data["results_json"] = json.dumps(jsonlist)

    con.close()

    return HttpResponse(json.dumps(data), content_type="text/json")


# def api_create_view(request, *args, **kwargs):
    # context = RequestContext(request)
    
    # data = []
    
    # return HttpResponse(json.dumps(data), content_type="text/json")

# def api_update_view(request, *args, **kwargs):
    # context = RequestContext(request)
    
    # data = []
    
    # return HttpResponse(json.dumps(data), content_type="text/json")