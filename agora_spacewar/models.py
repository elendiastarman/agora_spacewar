from django.db import models
from django.core.exceptions import ObjectDoesNotExist

# Create your models here.
class Player(models.Model):
    username = models.CharField(max_length=30)
    email = models.EmailField()
    
    numGames = models.IntegerField(default=0)
    numWins = models.IntegerField(default=0)
    numLosses = models.IntegerField(default=0)
    numTies = models.IntegerField(default=0)
    numMissiles = models.IntegerField(default=0)
    
class Game(models.Model):
    player1 = models.ForeignKey(Player, related_name="p1games")
    player2 = models.ForeignKey(Player, related_name="p2games")
    
    frameStart = models.IntegerField(default=0)
    frameEnd = models.IntegerField()
    
    numRounds = models.IntegerField()
    p1wins = models.IntegerField(default=0)
    p2wins = models.IntegerField(default=0)
    ties = models.IntegerField(default=0)
    p1missiles = models.IntegerField(default=0)
    p2missiles = models.IntegerField(default=0)
    
    p1score = models.IntegerField(default=0)
    p2score = models.IntegerField(default=0)
    
class Round(models.Model):
    player1 = models.ForeignKey(Player, related_name="p1rounds")
    player2 = models.ForeignKey(Player, related_name="p2rounds")
    game = models.ForeignKey(Game)
    
    frameStart = models.IntegerField()
    frameEnd = models.IntegerField()
    
    p1win = models.BooleanField(default=0)
    p2win = models.BooleanField(default=0)
    tie = models.BooleanField(default=0)
    p1missiles = models.IntegerField(default=0)
    p2missiles = models.IntegerField(default=0)

class Event(models.Model):
    round = models.ForeignKey(Round)
    
    type = models.CharField(max_length=20)
    player = models.ForeignKey(Player, null=True,blank=True, related_name="events")
    frame = models.IntegerField()
    
    status = models.CharField(max_length=5, null=True,blank=True) #for game/round start/end
    score = models.IntegerField(null=True,blank=True)
    way = models.CharField(max_length=5, null=True,blank=True) #for right/left turns
    shape = models.CharField(max_length=10, null=True,blank=True) #for ship shape
    mid = models.IntegerField(null=True,blank=True) #missile id
    mteam = models.ForeignKey(Player, null=True,blank=True, related_name="missile_events") #the player who fired the missile
    why = models.CharField(max_length=10, null=True,blank=True) #generally for death-related events

class AchievementTemplate(models.Model):
    name = models.CharField(max_length=30)
    description = models.CharField(max_length=200)

class Achievement(models.Model):
    player = models.ForeignKey(Player)
    template = models.ForeignKey(AchievementTemplate)
    game = models.ForeignKey(Game)
    round = models.ForeignKey(Round, null=True,blank=True)
    frame = models.IntegerField()
