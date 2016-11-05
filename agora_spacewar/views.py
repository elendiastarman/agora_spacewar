from django.shortcuts import render, redirect
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.core.urlresolvers import reverse
from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned

from django.template import Context, RequestContext
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
from django.views.decorators.csrf import csrf_exempt

import os
import json
import sys
import urllib
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

    return render(request, 'agora_spacewar/main.html', context_instance=context)
