!  GridGenDll.f90 
!
!  FUNCTIONS/SUBROUTINES exported from GridGenDll.dll:
!  GridGenDll - subroutine 
!
        subroutine GridGenDll

  ! Expose subroutine GridGenDll to users of this DLL
  !
       !DEC$ ATTRIBUTES DLLEXPORT::GridGenDll
       

  ! Variables

 ! Body of GridGenDll
! This program generates rectangular grid data for 2dsoil02
! or rectangular part of the grid if the latter has some
! triangular elements in the upper part.
! the maximum number of nodes for now is 2500
! it creates a file called datagen2.dat This file is deleted in the calling program
! 6/22/2008 I've updated this to include solute files and different materials.
!  also nitrogen and organi! matter.
! 2/16/2011 dt - modified to work with c# program to create soil files.
! here we only need the grid creation program
! L(z) = L0 * exp(-a * z)
! L(x, z) = L00 * exp(-ax * |x|) * exp(-az * z) I don't see the second z or x in equatoin in spreadsheet
!a_z			3.885265197	[m^-1]
!a_x			7.770530394	[m^-1]
!L_00			158500.4994	[m/m^3] multiplied by 0.0001 units seem to be in m. divide x and y by 100
! from GP2D output is cm cm-3 roots length
!*********************************************************************************************
! 1/30/2009 This has been updated for 6-inch TUBE in the GROWTH CHAMBERS.
!
!     NP_temp(100) for Number of node of seepage face
!*********************************************************************************************
      dimension x(2500),y(2500),MatNum(2500),hBot(100),NP_temp(100)
      integer kx(2500,4)
      real WidthE(2500), HeightE(2500),    &
       xCenter(2500), yCenter(2500),xx(2500),yy(2500)
      character*132 GridGenFile,GridFile
      common /TransferInfo/ GridGenFile, GridFile
      integer e,e00, BC, GasBCTop, GasBCBot
      open(8,file='datagen2.dat')
      read(8,*)
      read(8,*) IJ,E00,n00,NumNP,NumEl, NMat, BC, GasBCTop, GasBCBot
! AD changed NumMat to NMat and now it is read correctly      
! AD IJ - number of vertical lines in the rectangular part
! EOO - number of the first element in the rectangular part of grid
! n00 - number of the first node of the rectangular part of grid
      read(8,*)
      read(8,*) (x(j),j=1,IJ)
! x coordinates of the vertical grid lines from the left to the right
      read(8,*)
! y coordinates of horizontal grid lines from the top to the bottom
! AD changed Numlin=(NumNP-n00)/IJ+1
         Numlin=NumNP/IJ
         NumElemR=IJ-1
  
! NumLin - number of horizontal lines
! NumElemR - number of elements in the row
      read(8,*) (y(i),i=1,Numlin)
	     do i=1,NumLin
	       MatNum(i)=1    ! will be filled out in the c program
	     end do 
!
! AD took out      NumMat=1
! AD replaced NumMat by NMat in (9,103)
!	Number of Boundary Nodes
	NumBP=2*IJ                ! assumes IJ is always the x dimension
      open(9,file='grid_bnd')
      write(9,101)
         write(9,102)
         write(9,103) NumNP,NumEl,NumBP,IJ,NMat
         write(9,104)
101   format('***************** GRID GENERATOR INFORMATION ***********&
       ***********************************')
102   format('KAT   NumNP    NumEl   NumBP    IJ   NumMat')
103   format(2x,'2',3i8,2i7)
104   format('   n           x          y      MatNum')
      do i=1,NumLin
        do j=1,IJ
          n=n00+(i-1)*IJ+j-1
          xN=x(j)
          yN=y(i)
	        MatNum1=MatNum(i)
          write(9,105) n,xN,yN,MatNum1
          XX(n)=xN
          YY(n)=yN
        enddo
      enddo
105   format(i5,2f12.2,i8)
      write(9,106)
      write(9,107)
106   format('***************** ELEMENT INFORMATION *****************&
      *************************************')
107   format('         e         i         j         k',&
            '         l     MatNumE')
      do i=1,NumLin-1
        do j=1,NumElemR
          e=e00+(i-1)*NumElemR+j-1
          k1=n00+(i-1)*IJ+j-1
          k4=k1+1
          k2=k1+IJ
          k3=k2+1
          write(9,108) e,k1,k2,k3,k4,MatNum(i+1)
          Kx(e,1)=k1
          Kx(e,2)=k2
          Kx(e,3)=k3
          Kx(e,4)=k4
108       format(6I10)
        enddo
      enddo
      write(9,109)
      write(9,110)
109   format('****************Boundary geometry information&
      **************************************')
110   format('    n  CodeW  CodeC  CodeH  CodeG  Width')
!	This is for 6-inch tubes in Growth Chambers.      
	do k=1,2  
		do j=1,IJ
			k2=min(IJ,j+1)
			k1=max(1,j-1)
			Width=(x(k2)-x(k1))/2.
			if(k.eq.1) then
				write(9,111) j,GasBCTop, Width
			else
				write(9,112) IJ*(Numlin-1)+j,BC, GasBCBot, Width
			endif
!	for Top boudary - always atmospheric
111			format(i5,' -4    0     -4 ', i5, f10.2)
!	for Bottom boudary
! DT 6/20/2017 Bottom BC is now a parameter (2nd i5)
112			format(i5, i5, '   0       1     ', i5,f10.2)

		enddo
  enddo
! done writing boundary code info, now add specifics for different kinds of boundaries
! this is for constant BC
199   format('***************************Seepage face information&
     ********************************************'&
     ,/,'NSeep',/,'  0') 
! this is a seepage face.      
201   format('***************************Seepage face information&
     ********************************************'&
     ,/,'NSeep',/,'  1',/,'NSP(1)')
 
     IJWrite=0
     if (BC.eq.-2) then
        write(9,201)  ! write header
    	write(9,202) IJ
202	    format(i3)
	    do i=1,IJ
		  	NP_temp(i)=IJ*(Numlin-1)+i
	    enddo
	   write(9,203)
203	  format('NP(NSP,1)  NP(NSP,2)  NP(NSP,3) ...... NP(NSP,IJ-1)&
       NP(NSP,IJ)')
       write(9,204) (NP_temp(i),i=1,IJ)
204	  format(100i8)
        
        else 
          write(9,199) 
      endif
 ! seepage boundary!     for Drainage Boundary
!     Not needed for 6-inch tube in Growth Chambers
      ! need to modify this later when we have a drainage boundary
	write(9,205)
205	format('***************************Drainage Boundaries&
     ******************************************',/,&
     'NDrain',/,&
     '0')
      close(9)

! AD Feb2011 changed the output for hBot. hBot is now the potential at the bottom
! of a given soil layer or line, not at the bottom of the domain as before.
! nodal data is now written in the C Program.
!*******************************
! It will go to "...\Element\*.elm
!*******************************

      end subroutine GridGenDll
