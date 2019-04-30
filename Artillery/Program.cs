using System;

namespace Artillery
{
    class Program
    {
        static void Main(string[] args)
        {

            Console.Clear();
            Console.ForegroundColor = ConsoleColor.Green;
            for(int x= 0; x < 80; x++)
            {
                Console.SetCursorPosition(x, x/10);
                Console.Write("#");
            }
            Console.WriteLine();
            Console.WriteLine("Hello World!");
        }
    }
}
