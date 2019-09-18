using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace SkyNet
{
    public abstract class BaseModel : INotifyPropertyChanged
    {
        ///// <summary>
        ///// Used to help specify special edit controls
        ///// </summary>
        //private UserControl foo;

        //public UserControl EditControl
        //{
        //    get { return foo; }
        //    set { foo = value; }
        //}

        /// <summary>
        /// Use in tree views to set the Tag to the current context object
        /// </summary>
        public object This { get { return this; } }

        public event PropertyChangedEventHandler PropertyChanged;

        // --------------------------------------------------------------------------------
        /// <summary>
        /// Constructor
        /// </summary>
        // --------------------------------------------------------------------------------
        public BaseModel()
        {
        }

        // --------------------------------------------------------------------------------
        /// <summary>
        /// Notify the UI that the property changed.   This also marks the entire 
        /// collection as "altered" so that we know to save it.
        /// </summary>
        // --------------------------------------------------------------------------------
        protected void RaisePropertyChanged(string name, bool markDocumentDirty = true)
        {
            if (PropertyChanged != null)
            {
                foreach (var method in PropertyChanged.GetInvocationList())
                {
                    method.DynamicInvoke(this, new PropertyChangedEventArgs(name));
                }
            }
        }
    }

}
