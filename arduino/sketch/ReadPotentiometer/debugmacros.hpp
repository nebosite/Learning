#ifdef DEBUG
//examples:
//#define DPRINT(args...)  Serial.print(args)  OR use the following syntax:
#define SERIALBEGIN(...)   Serial.begin(__VA_ARGS__)
#define DPRINT(...)        Serial.print(__VA_ARGS__)
#define DPRINTLN(...)      Serial.println(__VA_ARGS__)
#define DRINTF(...)        Serial.print(F(__VA_ARGS__))
#define DPRINTLNF(...)     Serial.println(F(__VA_ARGS__)) //printing text using the F macro
#define DELAY(...)         delay(__VA_ARGS__)
#define PINMODE(...)       pinMode(__VA_ARGS__)
#define TOGGLEd13          PINB = 0x20                    //UNO's pin D13

#define DEBUG_PRINT(...)   Serial.print(F(#__VA_ARGS__" = ")); Serial.print(__VA_ARGS__); Serial.print(F(" ")) 
#define DEBUG_PRINTLN(...) DEBUG_PRINT(__VA_ARGS__); Serial.println()

//***************************************************************
#else
#define SERIALBEGIN(...)  
#define DPRINT(...)       
#define DPRINTLN(...)     
#define DPRINTF(...)      
#define DPRINTLNF(...)    
#define DELAY(...)        
#define PINMODE(...)      
#define TOGGLEd13      

#define DEBUG_PRINT(...)    
#define DEBUG_PRINTLN(...)  

#endif