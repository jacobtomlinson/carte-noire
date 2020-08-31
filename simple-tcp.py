#!/bin/python
# TCP Server test stub - for testing ophir polling scripts

import socket
import sys

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

def socket_server(message,port):
    sock.listen(port)
    while True:
        conversation, client_address = sock.accept()
        #sock_read(conversation) # returns string ending in /
        conversation.recv(8)
        conversation.send(message)
        conversation.close()

def complex_socket_server(message_response_pairs,port):
    sock.listen(port)
    while True:
        conversation, client_address = sock.accept()
        #sock_read(conversation) # returns string ending in /
        rx = conversation.recv(8)[:-1]
        try: 
            conversation.send(message_response_pairs[rx])
        except:
            print(rx)
            pass
        finally:
            conversation.close()

pairs = { "mode?":"STANDBY, ALF!","temp?":"22C"}

complex_socket_server(pairs,10023)




#def sock_read(conversation):
#    conversation.recv(1)
    
