from pymongo import MongoClient
import os
import mysql.connector
from dotenv import load_dotenv
import csv
import requests


mydb=mysql.connector.connect(
    host="localhost",
    user="hairband_user",
    password="mypassword",
    database="project_db"
)
mycursor=mydb.cursor()
load_dotenv()
MONGO_URI=os.getenv("MONGO_URI") 
client=MongoClient(MONGO_URI)
db=client["project_DB_mongo"];
collection=db["profile_images"]

with open('batch_data.csv',mode='r')as file:
    suc=0
    notfound=0
    timeout=0
    coner=0
    unkno=0
    csvfile=csv.reader(file)
    next(csvfile)
    for row in csvfile:
        uid=row[0]
        name=row[1]
        website_url=row[2]
        image_url=website_url+"/images/pfp.jpg"
        image_url="https://"+image_url
        try:
            response=requests.get(image_url,timeout=5)

            if response.status_code ==200:
                image=response.content
                collection.update_one(
                    {"uid": uid},
                    {"$set": {"image": image}},
                    upsert=True
                )
                sql="INSERT INTO users (uid,name) VALUES (%s,%s) ON DUPLICATE KEY UPDATE name = %s"
                val=(uid,name,name)
                mycursor.execute(sql,val)
                mydb.commit()
                print(f"uid:{uid} Successfully added")
                suc+=1
            else:
                print(f"uid:{uid}Image not found")
                notfound+=1
        except Exception as e:
            if isinstance(e,requests.exceptions.Timeout):
                print(f"uid:{uid} Error:Timeout")
                timeout+=1
            elif isinstance (e,requests.exceptions.ConnectionError):
                print(f"uid:{uid} Error:Connection Error")
                coner+=1
            else:
                print("Unknown Error") 
                unkno+=1   

print("Inserted successfully!")
print(f"No. of Successful entries:{suc}")
print(f"No. of Images not found:{notfound}")
print(f"No. of time out errors:{timeout}")
print(f"No. of connection errors:{coner}")
print(f"No. of unknown errors:{unkno}")

