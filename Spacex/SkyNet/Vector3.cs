using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace SkyNet
{
    public struct Vector3
    {
        public double X, Y, Z;

        public Vector3 Normalized
        {
            get
            {
                var length = Length;
                if (length == 0) return this;
                return this / length;
            }
        }

        public double Length
        {
            get
            {
                return Math.Sqrt(LengthSquared);
            }
        }

        public double LengthSquared
        {
            get
            {
                return X * X + Y * Y + Z * Z;
            }
        }

        public Vector3(double x, double y, double z)
        {
            X = x;
            Y = y;
            Z = z;
        }

        public static Vector3 operator +(Vector3 first, Vector3 second)
        {
            return new Vector3(first.X + second.X, first.Y + second.Y, first.Z + second.Z);
        }

        public static Vector3 operator -(Vector3 first, Vector3 second)
        {
            return new Vector3(first.X - second.X, first.Y - second.Y, first.Z - second.Z);
        }

        public static Vector3 operator *(double number, Vector3 vector)
        {
            return new Vector3(vector.X * number, vector.Y * number, vector.Z * number);
        }

        public static Vector3 operator *(Vector3 vector, double number)
        {
            return new Vector3(vector.X * number, vector.Y * number, vector.Z * number);
        }

        public static Vector3 operator /(Vector3 vector, double number)
        {
            return new Vector3(vector.X / number, vector.Y / number, vector.Z / number);
        }

    }
}
